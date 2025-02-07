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
  registeredTestDiner.email =
    Math.random().toString(36).substring(2, 12) + "@testDiner.com";
  const registerRes = await request(app)
    .post("/api/auth")
    .send(registeredTestDiner);
  registeredTestDiner_AuthToken = registerRes.body.token;
  expectValidJwt(registeredTestFranchisee_AuthToken);
}

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);

  const loginRes = await request(app)
    .put("/api/auth")
    .send({ email: user.email, password: "toomanysecrets" });
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);
  testAdmin_AuthToken = loginRes.body.token;
}

describe("createFranchise", () => {
  test("200 - allow admin for registered user", async () => {
    // create test data
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    // call the endpoint
    const response = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testFranchiseData);

    // check response status
    expect(response.status).toBe(200);

    // check return object

    expect(response.body).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        id: expect.any(Number),
        admins: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
            email: expect.any(String),
          }),
        ]),
      })
    );

    // check return object values
    expect(response.body.name).toBe(testFranchiseData.name);
    expect(response.body.admins[0].email).toBe(
      testFranchiseData.admins[0].email
    );
  });

  test("404 - cannot find nonexisting user", async () => {
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: "nonexistant-" + randomName() + "@test.com" }],
    };

    const response = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testFranchiseData);
    expect(response.status).toBe(404);

    return testFranchiseData;
  });

  test("401 - non-admin cannot create franchise", async () => {
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    const response = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${registeredTestFranchisee}`)
      .send(testFranchiseData);
    expect(response.status).toBe(401);
  });
});

test("getFranchises", async () => {
  const response = await request(app).get("/api/franchise");
  expect(response.status).toBe(200);
  expect(response.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        stores: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
          }),
        ]),
      }),
    ])
  );
});

describe("deleteFranchise", () => {
  test("200 - admin successfully creates store", async () => {
    // mock a franchise
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    const createFranRes = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testFranchiseData);

    testFranchiseData.id = createFranRes.body.id;

    // test delete response
    const response = await request(app)
      .delete(`/api/franchise/${testFranchiseData.id}`)
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`);
    expect(response.status).toBe(200);

    // check franchise gone
    const getFranchiseRes = await request(app).get("/api/franchise");
    expect(getFranchiseRes.body).not.toContainEqual(
      expect.objectContaining({
        id: testFranchiseData.id,
      })
    );
  });

  test("403 - non-admin fails ", async () => {
    // create a franchise
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    const createFranRes = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testFranchiseData);

    testFranchiseData.id = createFranRes.body.id;

    //test delete

    const response = await request(app)
      .delete(`/api/franchise/${testFranchiseData.id}`)
      .set("Authorization", `Bearer ${registeredTestFranchisee_AuthToken}`);
    expect(response.status).toBe(403);
  });
});

describe("createStore", () => {
  test("200 - admin success. CHECK RESPONSE", async () => {
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    const createFranRes = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testFranchiseData);

    testFranchiseData.id = createFranRes.body.id;

    const testStoreData = {
      franchiseId: testFranchiseData.id,
      name: "testStore",
    };

    const response = await request(app)
      .post(`/api/franchise/${testFranchiseData.id}/store`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testStoreData);
    expect(response.status).toBe(200);

    // check response json object
    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: expect.any(String),
        franchiseId: expect.any(Number),
      })
    );

    // check response json object values
    expect(response.body.name).toBe(testStoreData.name);
    expect(response.body.franchiseId).toBe(testStoreData.franchiseId);
  });

  test("200 - franchisee authorized", async () => {
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    const createFranRes = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
      .send(testFranchiseData);

    testFranchiseData.id = createFranRes.body.id;

    const testStoreData = {
      franchiseId: testFranchiseData.id,
      name: "testStore",
    };

    const response = await request(app)
      .post(`/api/franchise/${testFranchiseData.id}/store`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${registeredTestFranchisee_AuthToken}`)
      .send(testStoreData);
    expect(response.status).toBe(200);
  });

  test("403 - nonFranchisee or Admin unauthorized", async () => {
    const testFranchiseData = {
      name: "testFranchise-" + randomName(),
      admins: [{ email: registeredTestFranchisee.email }],
    };

    const createFranRes = await request(app)
      .post("/api/franchise")
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${registeredTestDiner_AuthToken}`)
      .send(testFranchiseData);

    testFranchiseData.id = createFranRes.body.id;

    const testStoreData = {
      franchiseId: testFranchiseData.id,
      name: "testStore",
    };

    const response = await request(app)
      .post(`/api/franchise/${testFranchiseData.id}/store`)
      .set("Content-Type", "application/json")
      .set("Authorization", `Bearer ${registeredTestDiner_AuthToken}`)
      .send(testStoreData);
    expect(response.status).toBe(403);

    // expect(response.body).toEqual(
  });

  // const registeredTestUser = {
  //   name: "pizza diner",
  //   email: "reg@test.com",
  //   password: "a",
  // };
  // registeredTestUser.email =
  //   Math.random().toString(36).substring(2, 12) + "@test.com";
  // const registerRes = await request(app)
  //   .post("/api/auth")
  //   .send(registeredTestUser);
  // registeredTestUser_AuthToken = registerRes.body.token;
  // expectValidJwt(registeredTestUser_AuthToken);
});

test("delete Store", async () => {
  const testFranchiseData = {
    name: "testFranchiseDeleteStore-" + randomName(),
    admins: [{ email: registeredTestFranchisee.email }],
  };

  const createFranRes = await request(app)
    .post("/api/franchise")
    .set("Content-Type", "application/json")
    .set("Authorization", `Bearer ${testAdmin_AuthToken}`)
    .send(testFranchiseData);

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

  const storeId = createStoreResponse.body.id;

  const deleteStoreResponse = await request(app)
    .delete(`/api/franchise/${testFranchiseData.id}/store/${storeId}`)
    .set("Authorization", `Bearer ${testAdmin_AuthToken}`);

  expect(deleteStoreResponse.status).toBe(200);

  //TODO check store gone
  expect(false).toBe(true);
});
