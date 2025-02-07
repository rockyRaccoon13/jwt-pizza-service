const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
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

test("login", async () => {
  const loginRes = await request(app)
    .delete("/api/auth")
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.message).toBe("logout successful");
});

// //description: 'Update user',
// example: `curl -X PUT localhost:3000/api/auth/1 -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json' -H 'Authorization: Bearer tttttt'`,
// response: { id: 1, name: '常用名字', email: 'a@jwt.com', roles: [{ role: 'admin' }] },

test("diner unable to update other user", async () => {
  const updatingUser = {
    name: "pizza diner",
    email: randomName() + "@test.com",
    password: "a",
  };

  await request(app).post("/api/auth").send(updatingUser);

  const newEmail = randomName();
  const newPassword = randomName();

  const updateRes = await request(app)
    .put(`/api/auth/${updatingUser.Id}`)
    .send({ email: newEmail, password: newPassword })
    .set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(updateRes.status).toBe(403);
  expect(updateRes.body.message).toBe("unauthorized");
});

test("admin able to update user", async () => {
  const adminUser = await createAdminUser();
  const adminUserAuthToken = (
    await request(app).put("/api/auth").send(adminUser)
  ).body.token;

  const updatingUser = {
    name: "pizza diner",
    email: randomName() + "@test.com",
    password: "a",
  };

  await request(app).post("/api/auth").send(updatingUser);

  const newEmail = randomName();
  const newPassword = randomName();

  const updateRes = await request(app)
    .put(`/api/auth/${updatingUser.Id}`)
    .send({ email: newEmail, password: newPassword })
    .set("Authorization", `Bearer ${adminUserAuthToken}`);
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.message).toBe("unauthorized");
  updatingUser.email = newEmail;
  updatingUser.password = newPassword;

  expect(updateRes.body).toMatchObject(updatingUser);
});

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}
