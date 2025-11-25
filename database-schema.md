# Database Schema

This document outlines the Firestore database schema for the Corbeanca Community application.

## `users`

Stores user profile information.

-   `uid`: (string) User's unique ID from Firebase Auth.
-   `name`: (string) User's display name.
-   `email`: (string) User's email address.
-   `phone`: (string) User's phone number.
-   `avatar`: (string) URL to the user's profile picture.
-   `role`: (string) 'user' or 'super-admin'.

## `posts`

Stores user-generated posts.

-   ... (existing post fields)

## `businesses` (New Collection)

Stores profiles of local businesses. Only super-admins can create these.

-   `id`: (string) Auto-generated document ID.
-   `name`: (string) Business name.
-   `description`: (string) Detailed description of the business.
-   `category`: (string) Business category (e.g., "Restaurant", "Retail", "Services").
-   `address`: (string) Physical address of the business.
-   `phone`: (string) Contact phone number.
-   `website`: (string) URL of the business's website.
-   `coverImage`: (string) URL to a cover image for the business profile.
-   `ownerUid`: (string) The UID of the super-admin who created the entry.
-   `createdAt`: (Timestamp) The date and time the business was added.
-   `averageRating`: (number) The calculated average rating from all reviews.
-   `reviewCount`: (number) The total number of reviews.

### `businesses/{businessId}/reviews` (New Subcollection)

Stores user reviews for a specific business.

-   `id`: (string) Auto-generated document ID.
-   `rating`: (number) A rating from 1 to 5.
-   `text`: (string) The text content of the review.
-   `authorUid`: (string) The UID of the user who wrote the review.
-   `authorName`: (string) The name of the user who wrote the review.
-   `createdAt`: (Timestamp) The date and time the review was submitted.
