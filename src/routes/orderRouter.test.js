const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

let testAdmin_AuthToken;

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}

beforeAll(async () => {
  await createAdminUser();
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  //mock admin user
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  //add user to db
  user = await DB.addUser(user);

  //login user to get authtoken
  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: user.email, password: "toomanysecrets" });
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);
  testAdmin_AuthToken = loginRes.body.token;
}

// {
//   method: 'PUT',
//   path: '/api/order/menu',
//   requiresAuth: true,
//   description: 'Add an item to the menu',
//   example: `curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }'  -H 'Authorization: Bearer tttttt'`,
//   response: [{ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 }],
// },

test("addMenuItem", async () => {
  const newMenuItem = {
    title: "testPizza",
    description: randomName(),
    image: "random.png",
    price: 0.1234,
  };

  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .send(newMenuItem)
    .set("Authorization", `Bearer ${testAdmin_AuthToken}`);

  expect(addMenuItemRes.status).toBe(200);
  expect(addMenuItemRes.body).toEqual(
    expect.arrayContaining([expect.objectContaining(newMenuItem)])
  );
});

test("getMenu", async () => {
  // add menu item
  const menuItem = {
    title: "testPizza",
    description: randomName(),
    image: "random.png",
    price: 0.1234,
  };

  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .send(menuItem)
    .set("Authorization", `Bearer ${testAdmin_AuthToken}`);
  expect(addMenuItemRes.status).toBe(200);

  //TEST get menu
  const getMenuRes = await request(app).get("/api/order/menu");
  expect(getMenuRes.status).toBe(200);
  expect(getMenuRes.body).toEqual(
    expect.arrayContaining([expect.objectContaining(menuItem)])
  );
});
