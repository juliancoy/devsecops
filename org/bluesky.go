// bluesky.go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/Nerzal/gocloak/v12"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var (
	BLUESKY_PDS_URL string
	ENCRYPTION_KEY  string
)

func bluesky_init() {
	// Bluesky configuration
	BLUESKY_PDS_URL = os.Getenv("BLUESKY_HOST")
	// Initialize encryption key
	ENCRYPTION_KEY = os.Getenv("ENCRYPTION_KEY")
}

// creates a new Bluesky account and stores the credentials in Keycloak
func bluesky_createaccount(ctx context.Context, userID, email string) error {
	// Generate a random password
	password := generateRandomPassword()

	// Prepare account creation request
	data := map[string]string{
		"email":    email,
		"password": password,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal create account data: %w", err)
	}

	// Make API request to create Bluesky account
	req, err := http.NewRequestWithContext(ctx, "POST",
		BLUESKY_PDS_URL+"/xrpc/com.atproto.server.createAccount", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := api.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create account: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to create account: status %d", resp.StatusCode)
	}

	// Parse response credentials
	var creds BlueskyCredentials
	if err := json.NewDecoder(resp.Body).Decode(&creds); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	// Encrypt password for storage
	encryptedPassword, err := encrypt(encryptionKey, password)
	if err != nil {
		return fmt.Errorf("failed to encrypt password: %w", err)
	}

	// Update Keycloak user attributes with Bluesky credentials
	attributes := map[string][]string{
		"bluesky_handle":   {creds.Handle},
		"bluesky_password": {encryptedPassword},
	}

	keycloak_updateuser(
		ctx,
		api.keycloakMgr.adminToken.AccessToken,
		api.keycloakMgr.userRealm,
		gocloak.User{
			ID:         &userID,
			Attributes: &attributes,
		},
	)
	return nil
}

// SendMessage sends a message to another user via Bluesky
func bluesky_sendmessage(c *gin.Context) {
	// Parse request body
	var req struct {
		RecipientHandle string `json:"recipient_handle"`
		Message         string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Get sender's user ID from authenticated session
	senderUserID := c.GetString("user_id") // Assuming auth middleware sets this

	// Get sender's Bluesky credentials
	senderCreds, err := c.GetCredentials(c.Request.Context(), senderUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get sender credentials: %v", err)})
		return
	}

	// Create message record
	msg := Message{
		ID:        uuid.New(),
		Sender:    senderUserID,
		Recipient: req.RecipientHandle,
		Message:   req.Message,
		Timestamp: time.Now(),
	}

	// Send message via Bluesky API
	if err := api.sendBlueskyMessage(c.Request.Context(), senderCreds, req.RecipientHandle, msg.Message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to send message: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "Message sent successfully"})
}

// GetMessages retrieves messages for a user
func bluesky_getmessages(ctx context.Context, creds *BlueskyCredentials) ([]BlueskyMessage, error) {
	userID := c.Query("user")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User query parameter is required"})
		return
	}

	// Get user's Bluesky credentials
	creds, err := bluesky_getcredentials(context.Background(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user credentials"})
		return
	}

	// Fetch messages from Bluesky
	messages, err := blueskyAPI.GetMessages(context.Background(), creds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})

	req, err := http.NewRequestWithContext(ctx, "GET", BLUESKY_PDS_URL+"/xrpc/app.bsky.feed.getTimeline", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+creds.AccessToken)

	resp, err := api.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get messages: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get messages: status %d", resp.StatusCode)
	}

	var result struct {
		Feed []struct {
			Post BlueskyMessage `json:"post"`
		} `json:"feed"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	messages := make([]BlueskyMessage, 0, len(result.Feed))
	for _, item := range result.Feed {
		messages = append(messages, item.Post)
	}

	return messages, nil
}

// retrieves a user's Bluesky credentials from Keycloak
func bluesky_getcredentials(ctx context.Context, userID string) (*BlueskyCredentials, error) {
	if err := api.keycloakMgr.EnsureTokenValidity(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure token validity: %w", err)
	}

	// Get user from Keycloak
	user, err := api.keycloakMgr.client.GetUser(
		ctx,
		api.keycloakMgr.adminToken.AccessToken,
		api.keycloakMgr.userRealm,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user.Attributes == nil {
		return nil, fmt.Errorf("user has no Bluesky credentials")
	}

	attrs := *user.Attributes
	handle := attrs["bluesky_handle"]
	encryptedPassword := attrs["bluesky_password"]

	if len(handle) == 0 || len(encryptedPassword) == 0 {
		return nil, fmt.Errorf("user has incomplete Bluesky credentials")
	}

	// Decrypt password
	password, err := decrypt([]byte(os.Getenv("ENCRYPTION_KEY")), encryptedPassword[0])
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt password: %w", err)
	}

	return &BlueskyCredentials{
		Handle:   handle[0],
		Password: password,
	}, nil
}
