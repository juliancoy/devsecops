# Generate a wildcard cert for this domain unsafely
certbot certonly --register-unsafely-without-email --standalone -d $VITE_PUBLIC_URL
