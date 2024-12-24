// main.go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	keycloak_initialize()

	// Start background task to check for users without Bluesky accounts
	go func() {
		for {
			if err := checkAndCreateBlueskyAccounts(context.Background()); err != nil {
				fmt.Printf("Error checking for users without Bluesky accounts: %v\n", err)
			}
			time.Sleep(5 * time.Minute)
		}
	}()

	// Create a new Gin router
	router := gin.Default()

	// Define a group for routes under the /org base path
	orgRoutes := router.Group("/org")
	{
		orgRoutes.GET("/", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"message": "Org backend is running",
			})
		})

		orgRoutes.GET("/users", func(c *gin.Context) {
			users, err := keycloak_getusers(context.Background())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"users": users})
		})

		// Keycloak webhook for user events
		orgRoutes.POST("/webhook/user", keycloakUserEvent)

		// Message endpoints now use Bluesky
		orgRoutes.POST("/messages", bluesky_sendmessage)
		orgRoutes.GET("/messages", bluesky_getmessages)
	}

	// Start the server
	port := "8085"
	fmt.Printf("Starting server on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		fmt.Printf("Failed to start server: %v\n", err)
		os.Exit(1)
	}
}

// checkAndCreateBlueskyAccounts checks for users without Bluesky accounts and creates them
func checkAndCreateBlueskyAccounts(ctx context.Context) error {
	// Get all users
	users, err := keycloak_getusers(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch users: %w", err)
	}

	// Check each user for Bluesky account
	for _, user := range users {
		if user.Attributes == nil || len((*user.Attributes)["bluesky_handle"]) == 0 {
			if err := bluesky_createaccount(ctx, *user.ID, *user.Email); err != nil {
				fmt.Printf("Failed to create Bluesky account for user %s: %v\n", *user.ID, err)
				continue
			}
		}
	}

	return nil
}
