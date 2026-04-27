ALTER TABLE users
ADD COLUMN IF NOT EXISTS password VARCHAR(255) NULL AFTER email;

ALTER TABLE recipes
ADD COLUMN IF NOT EXISTS external_id VARCHAR(50) NULL AFTER id,
ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Unknown' AFTER name,
ADD COLUMN IF NOT EXISTS cuisine VARCHAR(100) NOT NULL DEFAULT 'Unknown' AFTER category,
ADD COLUMN IF NOT EXISTS image_url TEXT NULL AFTER cuisine,
ADD COLUMN IF NOT EXISTS instructions_text TEXT NULL AFTER description;

ALTER TABLE recipe_instructions
ADD COLUMN IF NOT EXISTS instruction_text TEXT NULL AFTER instructions;

UPDATE recipe_instructions
SET instruction_text = instructions
WHERE instruction_text IS NULL;

SHOW COLUMNS FROM users;
SHOW COLUMNS FROM recipes;
SHOW COLUMNS FROM recipe_instructions;

ALTER TABLE uses
ADD COLUMN IF NOT EXISTS unit VARCHAR(100) NOT NULL DEFAULT 'item' AFTER quantity;

ALTER TABLE grocery_lists
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER description,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE contains
ADD COLUMN IF NOT EXISTS unit VARCHAR(100) NOT NULL DEFAULT 'item' AFTER quantity,
ADD COLUMN IF NOT EXISTS purchased TINYINT(1) NOT NULL DEFAULT 0 AFTER unit,
ADD COLUMN IF NOT EXISTS note TEXT NULL AFTER purchased;

ALTER TABLE saves
ADD COLUMN IF NOT EXISTS is_favorite TINYINT(1) NOT NULL DEFAULT 0 AFTER recipe_id,
ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_favorite;

SHOW COLUMNS FROM uses;
SHOW COLUMNS FROM contains;
SHOW COLUMNS FROM saves;

CREATE TABLE IF NOT EXISTS recipe_notes (
  user_id INT NOT NULL,
  recipe_id INT NOT NULL,
  note TEXT,
  PRIMARY KEY (user_id, recipe_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY,
  default_list_name VARCHAR(255) DEFAULT 'Weekly Groceries',
  preferred_export_format VARCHAR(20) DEFAULT 'csv',
  show_purchased_in_exports TINYINT(1) NOT NULL DEFAULT 1,
  show_notes_in_exports TINYINT(1) NOT NULL DEFAULT 1,
  accent_mode VARCHAR(50) DEFAULT 'warm',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT IGNORE INTO user_settings (
  user_id,
  default_list_name,
  preferred_export_format,
  show_purchased_in_exports,
  show_notes_in_exports,
  accent_mode
)
SELECT
  id,
  'Weekly Groceries',
  'csv',
  1,
  1,
  'warm'
FROM users;
