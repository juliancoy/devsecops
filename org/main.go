package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"

	"github.com/Nerzal/gocloak/v12"
	"github.com/gin-gonic/gin"
)

var (
	orgBackendClient *gocloak.GoCloak
	adminToken       *gocloak.JWT
)

func main() {
	// Keycloak configuration
	keycloakURL := os.Getenv("KEYCLOAK_SERVER_URL")
	realm := "master"
	//clientID := "admin-cli"
	username := os.Getenv("KEYCLOAK_ADMIN")
	password := os.Getenv("KEYCLOAK_ADMIN_PASSWORD")

	// Initialize the GoCloak client
	orgBackendClient = gocloak.NewClient(keycloakURL)
	orgBackendClient.RestyClient().SetTLSClientConfig(&tls.Config{InsecureSkipVerify: true})

	// Authenticate admin
	ctx := context.Background()
	fmt.Println("Authenticating admin...")
	var err error
	adminToken, err = orgBackendClient.LoginAdmin(ctx, username, password, realm)
	if err != nil {
		fmt.Printf("Failed to authenticate admin: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Successfully authenticated admin!")

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
		// Fetch users from Keycloak
		users, err := orgBackendClient.GetUsers(ctx, adminToken.AccessToken, realm, gocloak.GetUsersParams{})
		if err != nil {
			fmt.Printf("Failed to fetch users: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
			return
		}

		// Map users to a simplified response structure
		var userList []map[string]interface{}
		for _, user := range users {
			userList = append(userList, map[string]interface{}{
				"id":       user.ID,
				"username": user.Username,
				"email":    user.Email,
			})
		}

		// Return the user list as JSON
		c.JSON(http.StatusOK, gin.H{"users": userList})
	})

	// Start the server on port 8085
	port := "8085"
	fmt.Printf("Starting server on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		fmt.Printf("Failed to start server: %v\n", err)
		os.Exit(1)
	}
}
