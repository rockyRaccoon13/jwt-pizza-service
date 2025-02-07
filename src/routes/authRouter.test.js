const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email =
    Math.random().toString(36).substring(2, 12) + "@authTests.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("register", async () => {
  const testRegisteringUser = {
    name: "registerTest",
    email: "reg@test.com",
    password: "a",
  };
  testRegisteringUser.email = randomName() + "@authRegisterTest.com";
  const registerRes = await request(app)
    .post("/api/auth")
    .send(testRegisteringUser);
  expect(registerRes.status).toBe(200);

  expectValidJwt(registerRes.body.token);
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

//     description: 'Logout a user',
//     example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer tttttt'`,
//     response: { message: 'logout successful' },

test("logout", async () => {
  const loginRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(loginRes.status).toBe(200);
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
