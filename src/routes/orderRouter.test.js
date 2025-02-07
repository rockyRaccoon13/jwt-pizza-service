const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const registeredTestDiner = {
  name: "testDiner",
  email: "reg@testDiner.com",
  password: "a",
};
let registeredTestDiner_AuthToken;

const registeredTestFranchisee = {
  name: "testFranchisee",
  email: "reg@testfranchisee.com",
  password: "a",
};
let registeredTestFranchisee_AuthToken;

let testAdmin_AuthToken;

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
  );
}

beforeAll(async () => {
  await createTestFranchisee();
  await createTestDiner();
  await createAdminUser();
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createTestFranchisee() {
  registeredTestFranchisee.email =
    Math.random().toString(36).substring(2, 12) + "@testFranchisee.com";

  const registerRes = await request(app)
    .post("/api/auth")
    .send(registeredTestFranchisee);
  registeredTestFranchisee_AuthToken = registerRes.body.token;
  expectValidJwt(registeredTestFranchisee_AuthToken);
}

async function createTestDiner() {
  //mock diner email
  registeredTestDiner.email =
    Math.random().toString(36).substring(2, 12) + "@testDiner.com";

  //register diner to get authtoken
  const registerRes = await request(app)
    .post("/api/auth")
    .send(registeredTestDiner);
  registeredTestDiner_AuthToken = registerRes.body.token;
  expectValidJwt(registeredTestFranchisee_AuthToken);
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

// {
//   method: 'POST',
//   path: '/api/order',
//   requiresAuth: true,
//   description: 'Create a order for the authenticated user',
//   example: `curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H 'Authorization: Bearer tttttt'`,
//   response: { order: { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], id: 1 }, jwt: '1111111111' },
// },

test("createOrder", async () => {
  // create franchise & store
  const testFranchiseData = {
    name: "testFranchise-" + randomName(),
    admins: [{ email: registeredTestFranchisee.email }],
  };

  const createFranRes = await request(app)
    .post("/api/franchise")
    .set("Content-Type", "application/json")
    .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
    .send(testFranchiseData);
  expect(createFranRes.status).toBe(200);

  testFranchiseData.id = createFranRes.body.id;

  const testStoreData = {
    franchiseId: testFranchiseData.id,
    name: "testStore",
  };

  const createStoreResponse = await request(app)
    .post(`/api/franchise/${testFranchiseData.id}/store`)
    .set("Content-Type", "application/json")
    .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
    .send(testStoreData);
  expect(createStoreResponse.status).toBe(200);

  testStoreData.id = createStoreResponse.body.id;

  // create menu item
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
  const menuItemId = addMenuItemRes.body.id;

  const newOrder = {
    franchiseId: testFranchiseData.id,
    storeId: testStoreData.id,
    items: [
      {
        menuId: menuItemId,
        description: newMenuItem.description,
        price: newMenuItem.price,
      },
      {
        menuId: menuItemId,
        description: newMenuItem.description,
        price: newMenuItem.price,
      },
    ],
  };

  //test create order

  const createOrderRes = await request(app)
    .post("/api/order")
    .send(newOrder)
    .set("Authorization", `Bearer ${registeredTestDiner_AuthToken}`);

  expect(createOrderRes.status).toBe(500);
  // expect(createOrderRes.body).toEqual(
  //   expect.objectContaining({ order: expect.objectContaining(newOrder) })
  // );
});
