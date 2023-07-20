const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("Server running"));
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
  }
};

initializeDbAndServer();

//API 1

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECERT_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
app.use(express.json());
app.post("/login/", async (request, response) => {
  const requestBody = request.body;
  console.log(requestBody);
  const { username, password } = requestBody;
  console.log(username, password);

  const getUser = `SELECT * FROM USER WHERE USERNAME='${username}';`;
  const user = await db.get(getUser);

  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    console.log(user.password);
    const hashPassword = user.password;
    const checkPassword = await bcrypt.compare(password, hashPassword);
    if (checkPassword) {
      console.log("authentication Success");
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECERT_KEY");
      response.send({jwtToken});
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-1

const convertDbToResponse = (dbObject) => {
  const object = {
    stateId: dbObject.state_id,
    stateName: `${dbObject.state_name}`,
    population: dbObject.population,
  };
  return object;
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM STATE;`;

  const getStates = await db.all(getStatesQuery);

  const result = getStates.map((eachState) => convertDbToResponse(eachState));

  response.send(result);
});

//API-2

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM STATE WHERE STATE_ID=${stateId};`;

  const getState = await db.get(getStateQuery);

  response.send(convertDbToResponse(getState));
});

//API-3
app.use(express.json());
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  console.log(request.body);
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addQuery = `
    INSERT INTO DISTRICT(DISTRICT_NAME,STATE_ID,CASES,CURED,ACTIVE,DEATHS) VALUES
    ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const addDistrict = await db.run(addQuery);
  response.send("District Successfully Added");
});

//API-4

const convertDbToResponseDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * FROM DISTRICT WHERE district_ID=${districtId};`;

    const getDistrict = await db.get(getDistrictQuery);

    response.send(convertDbToResponseDistrict(getDistrict));
  }
);

//API-5
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    Delete FROM DISTRICT WHERE district_ID=${districtId};`;

    const getDistrict = await db.run(getDistrictQuery);

    response.send("District Removed");
  }
);

//API-6

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const districtDetails = request.body;
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const addQuery = `
    UPDATE DISTRICT
    SET
    DISTRICT_NAME='${districtName}',
    STATE_ID=${stateId},CASES=${cases},CURED=${cured},
    ACTIVE=${active},DEATHS=${deaths}
    where district_id=${districtId}
    ;`;
    const addDistrict = await db.run(addQuery);
    response.send("District Details Updated");
  }
);

//API-7

const convertStats = (object) => {
  return {
    totalCases: object.totalCases,
    totalCured: object.totalCured,
    totalActive: object.totalActive,
    totalDeaths: object.totalDeath,
  };
};

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
    SELECT SUM(CASES) AS totalCases,
    SUM(CURED) AS totalCured,
    SUM(ACTIVE) AS totalActive,
    SUM(DEATHS) AS totalDeath
    FROM DISTRICT WHERE STATE_ID=${stateId};`;
    const getStats = await db.get(statsQuery);
    response.send(convertStats(getStats));
  }
);

//API-8

const convertState = (obj) => {
  return { stateName: obj.state_name };
};
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `
select state_id from district
where district_id = ${districtId};
`; //With this we will get the state_id using district table
    const getDistrictIdQueryResponse = await db.get(getDistrictIdQuery);

    const getStateNameQuery = `
select state_name as stateName from state
where state_id = ${getDistrictIdQueryResponse.state_id};
`; //With this we will get state_name as stateName using the state_id
    const getStateNameQueryResponse = await db.get(getStateNameQuery);
    response.send(getStateNameQueryResponse);
  }
);

module.exports = app;