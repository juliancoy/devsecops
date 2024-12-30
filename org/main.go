// main.go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	keycloak_initialize()

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
		// Protected routes (require authentication)
		protected := router.Group("/api")
		protected.Use(AuthMiddleware())
		{
			protected.POST("/sendmessage", bluesky_sendmessage)
			protected.GET("/getmessage", bluesky_getmessagesHandler)
			protected.GET("/user", keycloak_getuserdataHandler)
		}

		orgRoutes.GET("/users", func(c *gin.Context) {
			users, err := keycloak_getusers(context.Background())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
				return
			}

			c.JSON(http.StatusOK, gin.H{"users": users})
		})
	}

	// Start the server
	port := "8085"
	fmt.Printf("Starting server on port %s...\n", port)
	if err := router.Run(":" + port); err != nil {
		fmt.Printf("Failed to start server: %v\n", err)
		os.Exit(1)
	}
}
