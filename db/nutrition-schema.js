module.exports=function nutritionSchema(driver){
 const mysql=driver==='mysql',ref=mysql?'BIGINT UNSIGNED':'INTEGER',id=mysql?'BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT':'INTEGER PRIMARY KEY AUTOINCREMENT';
 const suffix=mysql?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':'';
 return [
  `CREATE TABLE IF NOT EXISTS nutrition_profiles (user_id ${ref} PRIMARY KEY, age INTEGER NOT NULL, sex VARCHAR(10) NOT NULL, height_cm DECIMAL(5,1) NOT NULL, weight_kg DECIMAL(5,1) NOT NULL, activity VARCHAR(12) NOT NULL, goal VARCHAR(12) NOT NULL, diet VARCHAR(12) NOT NULL, avoid_json TEXT NOT NULL, eligible INTEGER NOT NULL DEFAULT 1, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)${suffix};`,
  `CREATE TABLE IF NOT EXISTS nutrition_entries (id ${id}, user_id ${ref} NOT NULL, logged_date DATE NOT NULL, meal VARCHAR(12) NOT NULL, grams DECIMAL(8,2) NOT NULL CHECK(grams>0 AND grams<=5000), food_snapshot TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)${suffix};`
 ];
};
