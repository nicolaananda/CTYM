package admin

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidPassword = errors.New("invalid password")
	ErrInvalidToken    = errors.New("invalid token")
)

type AuthService struct {
	adminPasswordHash string
	jwtSecret         []byte
}

type Claims struct {
	Admin bool `json:"admin"`
	jwt.RegisteredClaims
}

func NewAuthService(adminPassword, jwtSecret string) (*AuthService, error) {
	// Hash the admin password
	hash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Generate JWT secret if not provided
	secret := []byte(jwtSecret)
	if jwtSecret == "" {
		secret = make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			return nil, err
		}
	}

	return &AuthService{
		adminPasswordHash: string(hash),
		jwtSecret:         secret,
	}, nil
}

func (a *AuthService) ValidatePassword(password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(a.adminPasswordHash), []byte(password)); err != nil {
		return ErrInvalidPassword
	}
	return nil
}

func (a *AuthService) GenerateToken() (string, error) {
	claims := &Claims{
		Admin: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.jwtSecret)
}

func (a *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return a.jwtSecret, nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, ErrInvalidToken
}

func (a *AuthService) GetJWTSecretHex() string {
	return hex.EncodeToString(a.jwtSecret)
}
