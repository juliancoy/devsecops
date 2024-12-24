// keycloak.go
package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/Nerzal/gocloak/v12"
	"github.com/gin-gonic/gin"
)

// Lies they told us in school:
// 1) Don't use global variables
// 2) OOP makes things easier

// In fact, class-like structure is best implemented like this
var (
	keycloakURL string
	adminRealm  string
	username    string
	password    string
	client      *gocloak.GoCloak
	adminToken  *gocloak.JWT
	userRealm   string
	err         error
)

func keycloak_initialize() error {

	// Keycloak configuration
	keycloakURL := os.Getenv("KEYCLOAK_SERVER_URL")
	adminRealm := "master"
	username := os.Getenv("KEYCLOAK_ADMIN")
	password := os.Getenv("KEYCLOAK_ADMIN_PASSWORD")
	userRealm := "opentdf"
	client := gocloak.NewClient(keycloakURL)
	client.RestyClient().SetTLSClientConfig(&tls.Config{InsecureSkipVerify: false})

	fmt.Printf("Connecting to Keycloak at: %v\n", keycloakURL)
	fmt.Println("Authenticating admin...")

	ctx := context.Background()
	adminToken, err = client.LoginAdmin(ctx, username, password, adminRealm)

	fmt.Println("Successfully authenticated admin!")
	return nil
}

func keycloak_refreshtoken(ctx context.Context) error {
	// Check if the token has expired or is close to expiring
	if adminToken == nil || adminToken.ExpiresIn < 300 {
		fmt.Println("Refreshing admin token...")
		var err error
		adminToken, err = client.LoginAdmin(ctx, username, password, adminRealm)
		if err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}
		fmt.Println("Admin token refreshed successfully!")
	}
	return nil
}

func keycloak_getusers(ctx context.Context) ([]*gocloak.User, error) {
	if err := keycloak_refreshtoken(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure token validity: %w", err)
	}
	users, err := client.GetUsers(ctx, adminToken.AccessToken, userRealm, gocloak.GetUsersParams{})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch users: %w", err)
	}
	return users, nil
}

func keycloakUserEvent(c *gin.Context) {
	var event struct {
		Type string        `json:"type"`
		User *gocloak.User `json:"user"`
	}
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook payload"})
		return
	}

	if event.Type == "USER_CREATED" && event.User != nil {
		ctx := context.Background()
		encryptionKey := []byte(os.Getenv("ENCRYPTION_KEY"))

		if err := bluesky_createaccount(ctx, *event.User.ID, *event.User.Email, blueskyAPI, encryptionKey); err != nil {
			fmt.Printf("Failed to create Bluesky account for new user: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create Bluesky account"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "Webhook processed"})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Verify token using Keycloak's public key
		jwt_token, jwt_mapclaims, err := client.DecodeAccessToken(c.Request.Context(), token, "realm-name", "")

		// Proceed with the request
		c.Next()
	}
}
