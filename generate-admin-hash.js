const bcrypt = require('bcrypt');

bcrypt.hash('Admin@123', 10).then(hash => {
  console.log("-- Run this in your MySQL client:\n");
  console.log(
    "INSERT INTO Users (AccessId, Username, PasswordHash, FullName, Role, Department, Company, IsActive) VALUES\n" +
    "('ACC-ADMIN', 'admin', '" + hash + "', 'Administrator', 'admin', 'Administration', 'Your Company', 1);"
  );
});
