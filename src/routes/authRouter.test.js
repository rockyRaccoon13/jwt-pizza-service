const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("register new user", async () => {
  const registerTestUser = {
    name: "registerTest",
    email: "registerTest.com",
    password: "a",
  };
  registerTestUser.email =
    Math.random().toString(36).substring(2, 12) + "@registerTest.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  expect(registerRes.status).toBe(200);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test("register - invalid request", async () => {
  const registerTestUser = { name: "dinerRegisterTest", password: "a" };
  const registerRes = await request(app)
    .post("/api/auth")
    .send(registerTestUser);
  expect(registerRes.status).toBe(400);
  expect(registerRes.body.message).toMatch(
    "name, email, and password are required"
  );
});

test("login existing user", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("logout valid authToken ", async () => {
  const logoutRes = await request(app)
    .delete("/api/auth/")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe("logout successful");
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}


const unsedvar;

