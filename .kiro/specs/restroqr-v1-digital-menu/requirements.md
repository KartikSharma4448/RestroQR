# Requirements Document

## Introduction

RestroQR V1 is a simplified digital QR menu platform that enables restaurant owners to create and manage a digital menu accessible via a single QR code. The platform consists of three components: an Admin Panel for the platform admin, an Android Owner App for restaurant owners to manage their menu, and a Customer Website where diners view the menu by scanning the QR code. V1 is strictly view-only — no ordering, cart, or payment functionality is included.

## Glossary

- **Admin_Panel**: Web-based dashboard accessible exclusively by the platform Admin for managing all restaurants and owner accounts on the platform.
- **Admin**: The platform owner who has full access to the Admin Panel and can manage all restaurants and owner accounts.
- **Owner_App**: Android mobile application used by restaurant owners to register, set up their restaurant profile, build menus, and manage their QR code.
- **Restaurant_Owner**: A person who registers on the Owner App to create and manage a digital menu for their restaurant.
- **Customer_Website**: The public-facing website (restroqr.com) that displays a restaurant's menu when a customer scans the restaurant's QR code.
- **Restaurant_Token**: A unique, URL-safe identifier assigned to each restaurant, used in the QR URL format: restroqr.com/r/{restaurant_token}.
- **Category**: A grouping label for food items within a restaurant menu (e.g., Starters, Main Course, Beverages).
- **Food_Item**: A single menu entry containing name, description, price, image, veg/non-veg badge, and availability status.
- **QR_Code**: A single static QR code generated per restaurant that links to the restaurant's menu page on the Customer Website.

## Requirements

### Requirement 1: Admin Restaurant Management

**User Story:** As the Admin, I want to view and manage all registered restaurants from the Admin Panel, so that I can monitor and control the platform.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a paginated list of all registered restaurants showing restaurant name, owner name, and status (active or disabled).
2. WHEN the Admin selects a restaurant, THE Admin_Panel SHALL display the full restaurant profile including name, address, phone number, logo, cover image, owner details, and creation date.
3. WHEN the Admin edits a restaurant's details, THE Admin_Panel SHALL save the updated information and display a confirmation message.
4. WHEN the Admin disables a restaurant, THE Admin_Panel SHALL mark the restaurant as disabled and prevent the restaurant's menu from being displayed on the Customer_Website, showing an error page to customers who access the QR URL.
5. WHEN the Admin deletes a restaurant, THE Admin_Panel SHALL prompt for confirmation before permanently removing the restaurant and all associated data (profile, categories, food items, QR code) from the platform.
6. WHEN the Admin re-enables a previously disabled restaurant, THE Admin_Panel SHALL restore the restaurant's active status and allow the Customer_Website to display the menu again.

### Requirement 2: Admin Owner Account Management

**User Story:** As the Admin, I want to manage restaurant owner accounts, so that I can handle account issues and maintain platform integrity.

#### Acceptance Criteria

1. THE Admin_Panel SHALL display a list of all registered restaurant owner accounts showing owner name, email or phone number, and account status (active or disabled).
2. WHEN the Admin views an owner account, THE Admin_Panel SHALL display the owner's name, email, phone number, registration date, account status, and associated restaurant.
3. WHEN the Admin disables an owner account, THE Admin_Panel SHALL prevent the owner from logging into the Owner_App and display an appropriate error message to the owner on their next login attempt.
4. WHEN the Admin re-enables a previously disabled owner account, THE Admin_Panel SHALL restore the owner's ability to log in to the Owner_App.

### Requirement 3: Restaurant Owner Registration and Login

**User Story:** As a Restaurant Owner, I want to register and log in to the Owner App, so that I can manage my restaurant's digital menu.

#### Acceptance Criteria

1. WHEN a Restaurant Owner provides a valid email address or a valid 10-digit phone number, and a password of at least 8 characters, THE Owner_App SHALL create a new owner account and navigate to the restaurant profile setup screen.
2. WHEN a Restaurant Owner enters valid credentials on the login screen, THE Owner_App SHALL authenticate the owner and navigate to the Owner dashboard.
3. IF a Restaurant Owner enters invalid credentials (non-existent account or incorrect password), THEN THE Owner_App SHALL display an error message indicating authentication failure without revealing which field is incorrect.
4. IF a Restaurant Owner attempts to register with an already-registered email or phone number, THEN THE Owner_App SHALL display an error message indicating the account already exists.
5. IF a Restaurant Owner whose account has been disabled by the Admin attempts to log in, THEN THE Owner_App SHALL display an error message indicating the account is disabled and prevent access.
6. IF a Restaurant Owner submits the registration form with a password shorter than 8 characters or a missing email/phone number, THEN THE Owner_App SHALL display a validation error indicating the specific field requirement that is not met.

### Requirement 4: Restaurant Profile Setup

**User Story:** As a Restaurant Owner, I want to set up my restaurant profile with essential details, so that customers see my restaurant's identity when viewing the menu.

#### Acceptance Criteria

1. THE Owner_App SHALL allow the Restaurant Owner to create one restaurant profile with the following fields: Name (maximum 100 characters), Address (maximum 250 characters), Phone Number (maximum 20 characters), Logo image (JPEG, PNG, or WebP format, maximum 5 MB), and Cover image (JPEG, PNG, or WebP format, maximum 5 MB).
2. WHEN the Restaurant Owner saves a complete restaurant profile (Name, Address, and Phone Number provided), THE Owner_App SHALL store the profile information and auto-generate a QR code linked to the restaurant's customer menu page.
3. WHEN the Restaurant Owner updates any profile field, THE Owner_App SHALL save the updated information.
4. IF the Restaurant Owner submits a profile with missing required fields (Name, Address, Phone Number), THEN THE Owner_App SHALL display a validation error indicating which fields are missing.
5. IF the Restaurant Owner uploads an image that exceeds 5 MB or is not in JPEG, PNG, or WebP format, THEN THE Owner_App SHALL reject the upload and display an error message indicating the file size limit and accepted formats.

### Requirement 5: Menu Category Management

**User Story:** As a Restaurant Owner, I want to create and manage menu categories, so that I can organize food items logically for customers.

#### Acceptance Criteria

1. WHEN the Restaurant Owner creates a new category with a name between 1 and 50 characters that is unique within the restaurant (case-insensitive), THE Owner_App SHALL add the category to the restaurant's menu and display it in the category list.
2. IF the Restaurant Owner attempts to create or edit a category with a name that already exists in the same restaurant, or with an empty name, or a name exceeding 50 characters, THEN THE Owner_App SHALL reject the operation and display an error message indicating the reason for rejection.
3. WHEN the Restaurant Owner edits a category name, THE Owner_App SHALL update the category name and reflect the change in the category list.
4. WHEN the Restaurant Owner deletes a category, THE Owner_App SHALL remove the category and delete all food items belonging to that category from the restaurant's menu.
5. WHEN the Restaurant Owner reorders categories, THE Owner_App SHALL persist the new order and display categories in the updated sequence.
6. THE Owner_App SHALL display all categories in the order defined by the Restaurant Owner.

### Requirement 6: Food Item Management

**User Story:** As a Restaurant Owner, I want to add and manage food items within categories, so that customers can see the full menu with details.

#### Acceptance Criteria

1. WHEN the Restaurant Owner adds a food item to a category, THE Owner_App SHALL store the item with the following fields: Name (maximum 100 characters), Description (optional, maximum 500 characters), Price (between 0.01 and 999,999.99), Image (optional, JPEG/PNG/WebP, maximum 5 MB), Veg/Non-Veg badge, and Availability status (default: available).
2. WHEN the Restaurant Owner edits a food item's details, THE Owner_App SHALL save the updated information and display a confirmation that the changes were saved.
3. WHEN the Restaurant Owner marks a food item as unavailable, THE Owner_App SHALL update the item's availability status.
4. WHEN the Restaurant Owner deletes a food item, THE Owner_App SHALL remove the item from the menu.
5. IF the Restaurant Owner submits a food item with missing required fields (Name, Price, Veg/Non-Veg badge) or invalid values (Price outside 0.01–999,999.99, Name exceeding 100 characters, or Image exceeding 5 MB), THEN THE Owner_App SHALL display a validation error indicating which field failed validation and SHALL NOT save the item.
6. WHEN the Restaurant Owner adds, edits, or deletes a food item, THE Owner_App SHALL reflect the change on the Customer_Website within 5 seconds without requiring the customer to rescan the QR code.

### Requirement 7: QR Code Generation and Download

**User Story:** As a Restaurant Owner, I want a single QR code for my restaurant that always points to the latest menu, so that I can print it once and never need to regenerate it.

#### Acceptance Criteria

1. WHEN a Restaurant Owner completes the restaurant profile setup, THE Owner_App SHALL generate one QR code encoding the URL restroqr.com/r/{restaurant_token}.
2. THE Owner_App SHALL assign a unique Restaurant Token of at least 8 URL-safe alphanumeric characters to each restaurant at the time of QR code generation.
3. THE Owner_App SHALL allow the Restaurant Owner to download the QR code as a PNG image with a minimum resolution of 300x300 pixels.
4. WHEN the Restaurant Owner updates the menu, THE Owner_App SHALL retain the same QR code and Restaurant Token without regeneration.
5. IF QR code generation fails due to a system error, THEN THE Owner_App SHALL display an error message indicating QR code generation was unsuccessful and allow the Restaurant Owner to retry.

### Requirement 8: Owner Dashboard

**User Story:** As a Restaurant Owner, I want a simple dashboard showing my restaurant info, so that I can quickly review my setup.

#### Acceptance Criteria

1. THE Owner_App SHALL display a dashboard showing the restaurant name, logo, address, phone number, and QR code, along with navigation options to menu management, profile editing, and QR code download.
2. WHEN the Restaurant Owner opens the Owner App after login, THE Owner_App SHALL display the dashboard as the default screen.
3. IF the Restaurant Owner has not completed the restaurant profile setup, THEN THE Owner_App SHALL display the dashboard with a prompt indicating that profile setup is required, and SHALL omit the QR code until the profile is complete.
4. WHEN the Restaurant Owner navigates back to the dashboard after making changes elsewhere in the app, THE Owner_App SHALL display the latest saved restaurant information.

### Requirement 9: Customer Menu Viewing

**User Story:** As a customer, I want to view a restaurant's menu by scanning a QR code, so that I can browse available food items on my phone.

#### Acceptance Criteria

1. WHEN a customer scans the restaurant's QR code, THE Customer_Website SHALL open the restaurant's menu page in the device's browser.
2. IF the QR code references a restaurant that does not exist or has been deactivated, THEN THE Customer_Website SHALL display an error message indicating that the menu is not available.
3. THE Customer_Website SHALL display the restaurant name, logo, and cover image at the top of the menu page. IF a logo or cover image has not been uploaded, THEN THE Customer_Website SHALL display a default placeholder image in its place.
4. THE Customer_Website SHALL display food items grouped by category, in the display order configured by the restaurant owner.
5. THE Customer_Website SHALL display each food item with its name, price, and veg/non-veg badge. IF a description has been added for the item, THEN THE Customer_Website SHALL display the description. IF an image has been uploaded for the item, THEN THE Customer_Website SHALL display the image.
6. WHEN a food item is marked as unavailable, THE Customer_Website SHALL display the item with a visual indicator showing it is unavailable.
7. WHEN the menu page is loaded or refreshed, THE Customer_Website SHALL retrieve and display the latest version of the menu without requiring a new QR code scan.

### Requirement 10: Customer Menu Search and Filter

**User Story:** As a customer, I want to search and filter menu items, so that I can quickly find what I'm looking for.

#### Acceptance Criteria

1. WHEN a customer enters a search term, THE Customer_Website SHALL perform case-insensitive substring matching against item name and description, and display only food items that match, updating results in real time as the customer types.
2. WHEN a customer selects the Veg filter, THE Customer_Website SHALL display only food items marked as Veg.
3. WHEN a customer selects the Non-Veg filter, THE Customer_Website SHALL display only food items marked as Non-Veg.
4. WHEN a customer applies both a search term and a Veg or Non-Veg filter, THE Customer_Website SHALL display only items matching both the search term AND the selected badge filter.
5. WHEN a customer clears all filters and search, THE Customer_Website SHALL display all food items in the menu.
6. IF a search query or active filter results in zero matching food items, THEN THE Customer_Website SHALL display a message indicating no items match the current criteria.

### Requirement 11: Customer Website Performance and Responsiveness

**User Story:** As a customer, I want the menu page to load fast and look good on my phone, so that I have a smooth browsing experience.

#### Acceptance Criteria

1. THE Customer_Website SHALL render the menu page with a mobile-first responsive layout that adapts to screen sizes from 320px to 1440px width, with no horizontal scrolling, no content truncation, and no element overlap at any supported width.
2. THE Customer_Website SHALL load the menu page content within 3 seconds on a standard 4G mobile connection, measured from navigation start to largest contentful paint.
3. THE Customer_Website SHALL serve menu item images in compressed format with each image not exceeding 200 KB after server-side compression.

### Requirement 12: QR URL Validation and Security

**User Story:** As the Admin, I want invalid or tampered QR URLs to be handled gracefully, so that the platform remains secure and users are not confused.

#### Acceptance Criteria

1. IF a customer navigates to restroqr.com/r/{restaurant_token} with an invalid or non-existent Restaurant Token, THEN THE Customer_Website SHALL display an error page indicating the menu was not found without revealing whether the token format was invalid or simply not registered.
2. THE Customer_Website SHALL serve all pages exclusively over HTTPS and redirect any HTTP request to the equivalent HTTPS URL.
3. THE Customer_Website SHALL apply rate limiting of no more than 60 menu page requests per minute per IP address.
4. IF a client exceeds the rate limit, THEN THE Customer_Website SHALL reject the request and display an error page indicating the request was temporarily blocked due to too many attempts.
5. IF a restaurant is disabled by the Admin, THEN WHEN a customer navigates to that restaurant's QR URL, THE Customer_Website SHALL display an error page indicating the menu is not available.
6. THE Customer_Website SHALL NOT expose Restaurant Token details, internal identifiers, or system information on any error page.
