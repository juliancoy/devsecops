package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/Nerzal/gocloak/v12"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Config struct {
	KeycloakURL string
	AdminUser   string
	AdminPass   string
	Realm       string
}

var config = Config{
	KeycloakURL: os.Getenv("KEYCLOAK_SERVER_URL"),     // Keycloak server URL
	AdminUser:   os.Getenv("KEYCLOAK_ADMIN"),          // Admin username
	AdminPass:   os.Getenv("KEYCLOAK_ADMIN_PASSWORD"), // Admin password
	Realm:       "opentdf",                            // Keycloak realm
}

// Global GoCloak instance (pointer)
var orgBackendClient *gocloak.GoCloak

func getAllowedOrigins() []string {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		return []string{"https://localhost"} // Default origin
	}
	return strings.Split(origins, ",")
}

func main() {
	// Initialize the GoCloak client
	initializeClient()

	router := gin.Default()

	// Enable CORS with default settings
	router.Use(cors.New(cors.Config{
		AllowOrigins:     getAllowedOrigins(),
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Define routes
	router.GET("/", rootHandler)          // Service status endpoint
	router.GET("/users", getUsersHandler) // Get all users endpoint

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	// Use HTTP and bind to localhost
	router.Run(":" + port)
}

// initializeClient sets up the GoCloak client
func initializeClient() {
	orgBackendClient = gocloak.NewClient(config.KeycloakURL)
}

// authenticateAdmin logs in the admin user and returns the token
func authenticateAdmin(ctx context.Context) (*gocloak.JWT, error) {
	fmt.Println("Authenticating admin...")

	// Login admin to obtain a token
	token, err := orgBackendClient.LoginAdmin(ctx, config.AdminUser, config.AdminPass, "master")
	if err != nil {
		return nil, fmt.Errorf("failed to login as admin: %w", err)
	}

	fmt.Println("Admin authentication successful")
	return token, nil
}

// rootHandler serves a simple page indicating the service is up
func rootHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Service is up and running!",
		"status":  "OK",
	})
}

// getUsersHandler fetches a list of all users from Keycloak
func getUsersHandler(c *gin.Context) {
	ctx := c.Request.Context()

	// Re-authenticate admin to ensure a fresh token
	token, err := authenticateAdmin(ctx)
	if err != nil {
		fmt.Println("Failed to authenticate admin:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authenticate admin"})
		return
	}

	// Fetch users using the new admin token
	users, err := orgBackendClient.GetUsers(ctx, token.AccessToken, config.Realm, gocloak.GetUsersParams{})
	if err != nil {
		fmt.Println("Failed to fetch users:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}
