package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/Nerzal/gocloak/v12"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var (
	orgBackendClient *gocloak.GoCloak
	adminToken       *gocloak.JWT
	tokenMutex       sync.Mutex // Prevent concurrent token refreshes
	db               *gorm.DB   // Database connection
)

// Message represents a chat message stored in the database
type Message struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	Sender    string    `json:"sender"`
	Recipient string    `json:"recipient"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

func main() {
	// Keycloak configuration
	keycloakURL := os.Getenv("KEYCLOAK_SERVER_URL")
	adminRealm := "master"
	userRealm := "opentdf"
	username := os.Getenv("KEYCLOAK_ADMIN")
	password := os.Getenv("KEYCLOAK_ADMIN_PASSWORD")

	fmt.Printf("Connecting to Keycloak at: %v\n", keycloakURL)

	// Initialize the GoCloak client
	orgBackendClient = gocloak.NewClient(keycloakURL)
	orgBackendClient.RestyClient().SetTLSClientConfig(&tls.Config{InsecureSkipVerify: true})

	// Authenticate admin and fetch the initial token
	ctx := context.Background()
	fmt.Println("Authenticating admin...")
	var err error
	adminToken, err = loginAdmin(ctx, username, password, adminRealm)
	if err != nil {
		fmt.Printf("Failed to authenticate admin: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Successfully authenticated admin!")

	// Initialize the database
	db, err = gorm.Open(sqlite.Open("chat.db"), &gorm.Config{})
	if err != nil {
		fmt.Printf("Failed to connect to database: %v\n", err)
		os.Exit(1)
	}

	// Migrate the schema
	if err := db.AutoMigrate(&Message{}); err != nil {
		fmt.Printf("Failed to migrate database schema: %v\n", err)
		os.Exit(1)
	}

	// Create a new Gin router
	router := gin.Default()

	// Define the base endpoint
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Keycloak backend is running",
		})
	})

	// Define the /users endpoint
	router.GET("/users", func(c *gin.Context) {
		// Ensure the admin token is valid
		ctx := context.Background()
		err := ensureTokenValidity(ctx, username, password, adminRealm)
		if err != nil {
			fmt.Printf("Failed to refresh admin token: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authenticate admin"})
			return
		}

		// Fetch users from Keycloak
		users, err := orgBackendClient.GetUsers(ctx, adminToken.AccessToken, userRealm, gocloak.GetUsersParams{})
		if err != nil {
			fmt.Printf("Failed to fetch users: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}

		// Return the user list as JSON
		c.JSON(http.StatusOK, gin.H{"users": users})
	})

	// Define the /messages endpoint (POST)
	router.POST("/messages", func(c *gin.Context) {
		var message Message
		if err := c.ShouldBindJSON(&message); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		message.ID = uuid.New()
		message.Timestamp = time.Now()

		if err := db.Create(&message).Error; err != nil {
			fmt.Printf("Failed to save message: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save message"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "Message sent successfully"})
	})

	// Define the /messages endpoint (GET)
	router.GET("/messages", func(c *gin.Context) {
		recipient := c.Query("recipient")
		if recipient == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Recipient query parameter is required"})
			return
		}

		var messages []Message
		if err := db.Where("recipient = ?", recipient).Order("timestamp asc").Find(&messages).Error; err != nil {
			fmt.Printf("Failed to fetch messages: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"messages": messages})
	})

	// Start the server on port 8085
	port := "8085"
	fmt.Printf("Starting server on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		fmt.Printf("Failed to start server: %v\n", err)
		os.Exit(1)
	}
}

// loginAdmin logs in the admin user and fetches a token
func loginAdmin(ctx context.Context, username, password, realm string) (*gocloak.JWT, error) {
	return orgBackendClient.LoginAdmin(ctx, username, password, realm)
}

// ensureTokenValidity refreshes the token if it's expired
func ensureTokenValidity(ctx context.Context, username, password, realm string) error {
	tokenMutex.Lock()
	defer tokenMutex.Unlock()

	// Check if the token has expired or is close to expiring
	if adminToken == nil || tokenExpired(adminToken.ExpiresIn) {
		fmt.Println("Refreshing admin token...")
		var err error
		adminToken, err = loginAdmin(ctx, username, password, realm)
		if err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}
		fmt.Println("Admin token refreshed successfully!")
	}
	return nil
}

// tokenExpired checks if the token is expired or will expire soon
func tokenExpired(expiresIn int) bool {
	// Assume token is valid for 5 minutes less than its actual expiration time
	return expiresIn < 300
}
