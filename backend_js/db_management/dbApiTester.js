const { Pool, Client } = require('pg')

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'first_aid',
  password: 'password',
  port: 5432,
})

const dbApi = require('./dbApi')
const db = new dbApi(pool)
let test_user;
// db.ReturnUsers().then((result) => {
//     test_user = {"email":result[0].email,"pword":result[0].password}
//     console.log(test_user)
// }).catch((err) => {
//     console.log(err)
// });

var array = [
  {"first_name":"Antonio","last_name":"Washington","password":"password","email":"senortonito@gmail.com", "location":{"Address":"712 Pawnee Ln", "Country":"United States", "State":"Illinois", "City":"Naperville", "Zipcode":60563}, "isadmin":true},
  {"first_name":"Testing","last_name":"Guy","password":"password", "email":"testing.guy@tmail.com", "location":{"Address":"123 Example", "Country":"United States", "State":"Florida", "City":"Orlando", "Zipcode":32862}, "isadmin":false},
  {"first_name":"Babu","last_name":"Slapps","password":"password", "email":"babu.slapps@tmail.com", "location":{"Address":"111 Illiois Rd", "Country":"United States", "State":"Illinois", "City":"Naperville", "Zipcode":60563}, "isadmin":false},
  {"first_name":"Gordon","last_name":"Ramstein","password":"password", "email":"gordon.gluten@tmail.com", "location":{"Address":"001 Big Road Ln", "Country":"United States", "State":"Illinois", "City":"Naperville", "Zipcode":60560}, "isadmin":false},
];

for (let index = 0; index < array.length; index++) {
  const element = array[index];
  db.NewUser(element.first_name,element.last_name,element.password,element.email,element.location,element.isadmin)
}

array = [
  {"name":"Katrina","location":{"country":"USA","state":"Texas","city":"Dallas"},"keywords":{"type":["fire"],"items_need":["towels","food"]}},
  {"name":"Brookfield","location":{"country":"USA","state":"Illinois","city":"Chicago"},"keywords":{"type":["fire"],"items_need":["food"]}},
  {"name":"San Jose","location":{"country":"USA","state":"California","city":"San Jose"},"keywords":{"type":["earthquake"],"items_need":["construction"]}},
  {"name":"Jenny","location":{"country":"USA","state":"Iowa","city":"Iowa City"},"keywords":{"type":["tornado"],"items_need":["food"]}}
]

for (let index = 0; index < array.length; index++) {
  const element = array[index];
  db.AddDisaster(element.name,element.location,element.keywords)
}