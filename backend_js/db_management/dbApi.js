const bcrypt = require('bcrypt');
const { Pool, Client } = require('pg');
class dbApi{
  constructor(pool){
    this.pool = pool;
  }

  /**
   *
   * @param {*} requester
   * @param {*} item
   * @param {*} disaster
   * @param {*} quantity
   */
  async ManualRequest(requester_id, item_id, disaster_id, quantity){
    // insert request to req table
    var query_str = `INSERT INTO requests (requester_id, disaster_id, item_id, num_needed)
    VALUES(${requester_id},
      ${disaster_id},
      ${item_id},
      ${quantity});`;
    
      let res;
      try{
        res = await this.pool.query(query_str);
      }catch(e) {
        res = e;
      }
    return res
  }

  /**
   * reutnrs the requests pertaining to a certain disaster, need to order, so that oldest requests are 'first' in the list returned
   * @param {*} disaster_id 
   */
  async GetRequestsForDisaster(disaster_id){
    var query_str = `SELECT * FROM requests 
    WHERE disaster_id = '${disaster_id}' 
    AND num_provided != num_needed
    ORDER BY request_id ASC;`
    let res;
    try{
      res = await this.pool.query(query_str);
      res = res.rows;
    }catch(e){
      res = e;
    }

    return res; 
  }

  /**
   * Return contents of user table
   * returns {JSON} This will
  */
  async ReturnUsers(){
    let res;
    const query_str = `SELECT * FROM USERS;`;
    try{
      res = await this.pool.query(query_str);
      res = res.rows
    } catch(e){
      res = e
    }
    return res
  }

  /**
   * function takes an email and returns the donor id associated with the account
   * @param {} email 
   */
  async GetDonorID(email){
    let user = await this.GetUser(email)
    let user_id = user.user_id;

    let query_str = `SELECT donor_id FROM donors WHERE user_id='${user_id}';`
    let res;
    try{
      res = await this.pool.query(query_str);
      res = res.rows[0].donor_id;
    }catch(e){
      console.log(e)
      res = e;
    }
    return res;
  }


  async RecordDonation(request_id, donor_id, disaster_id, item_id, quantity){
    let query_str = `INSERT INTO donations (request_id, donor_id, disaster_id, item_id, quantity)
    VALUES(
      ${request_id},
      ${donor_id},
      ${disaster_id},
      ${item_id},
      ${quantity});`;
    
    let res;
    try{
      res = await this.pool.query(query_str);
    }catch(e){
      console.log(e);
      console.log("error is here")
      res = e;
    }
    return res;
  }

  /**
   * takes a request id and the number of provided items and updates the request in the table
   * This function could probably have a better name but I can't think of one right now
   * @param {} request_id 
   * @param {*} num_provided is the new value of num_provided
   */
  async UpdateNumNeeded(request_id, num_providing){
    //get current number provided
    var query_str = `SELECT num_provided FROM requests WHERE request_id='${request_id}';`
    let res;
    let current_num_provided;

    try{
      res = await this.pool.query(query_str);
      current_num_provided = res.rows[0].num_provided;

    }catch(e){
      console.log(e);
      res={success:false, donated:0}
      return res;
    }

    /**
     * stretch goal put check here to handle simultaneous donations to make sure things stay synchronized       
     */

    //calculate the new number and update it
    //console.log('current_num_provided: ' + current_num_provided)
    //console.log('num_providing: ' + num_providing)
    let new_num_provided = +current_num_provided + +num_providing;
    //console.log("New total: " + new_num_provided)
    query_str = `UPDATE requests 
                SET num_provided='${new_num_provided}' 
                WHERE request_id='${request_id}';`
    try{
      res = await this.pool.query(query_str);
    }catch(e){
      console.log(e)
      res={success:false, donated:0}
    }

    res = {success:true, donated:num_providing}
    return res;
  }

  /**
   * Takes a disaster_id item_ids and quantitys 
   * @param {*} disaster_id 
   * @param {*} item_ids item_ids will be an array of the items ids the user is donating
   * @param {*} quantitys  quantities will be an array of the items quantities, indexes will be lined up
   */
  async DonateItem(donor_id, disaster_id, item_id, quantity){
    let requests = await this.GetRequestsForDisaster(disaster_id)
    //console.log(requests)
    //console.log(item_id)
    //console.log(quantity)
    console.log("looking for donation...")
    //loop goes through requests for disaster and 'donates' item
    let finalRes = {success:false, donated:0};
    for(let i=0; i<requests.length; i++){
      let request = requests[i];
      //console.log(request)
      if(request.item_id == item_id){     
        let request_id = request.request_id;
        let num_needed = request.num_needed - request.num_provided;
        
        //probably some refactoring we can do here since code is so similar
        //case filling entire request
        if(quantity >= num_needed){
          let res = await this.UpdateNumNeeded(request_id, num_needed);
          console.log('donation found..')
          if(res.success){
              //RecordDonation
              quantity -= num_needed;
              await this.RecordDonation(request_id, donor_id, disaster_id, item_id, num_needed);
              finalRes.donated += +res.donated;
              finalRes.success = true;
          }else{
            return res;
          }
        }
        //case donating entire quantity
        else{
          let res = await this.UpdateNumNeeded(request_id, quantity)
          console.log('donation found..')
          if(res.success){
            //RecordDonation
            await this.RecordDonation(request_id, donor_id, disaster_id, item_id, quantity);
            finalRes.donated += +res.donated;
            finalRes.success = true;
            //return since user has no more to give
            return finalRes;
          }else{
            return res;
          }
        }
      }
    }
    return finalRes;
  }
  /**
   * Function gets all the currently requested items for every disaster
   * @param {*}  
   */
  async GetAllDisasterItems(){
    var query_str = `SELECT * FROM requests WHERE num_needed != num_provided;`
    let res;
    try{
      res = await this.pool.query(query_str);
      res = res.rows;
      let itemMap = {}
      for (let i=0; i<res.length; i++) {
        const element = res[i];
        const item = await this.GetItem(element.item_id);
        const disaster_id = element.disaster_id;

        //check if disaster_id not in map then add it
        if(itemMap[disaster_id] == null){
          itemMap[disaster_id] = {};
        }

        //check if item has been added before
        if (itemMap[disaster_id][element.item_id] == null){
          let tempMap = itemMap[disaster_id];
          tempMap[element.item_id] = 
          {
            item_id : item.item_id,
            name : item.name,
            type : item.type,
            keywords : item.keywords,
            num_needed : element.num_needed - element.num_provided,
          }; 
          itemMap[disaster_id] = tempMap
        }
        //item has already been added to just update num_needed
        else{
          //duplicate item found so merge num_needed
          itemMap[disaster_id][element.item_id].num_needed += 
          (element.num_needed - element.num_provided);
        }
      }
      res = itemMap;
    }catch(e){
      console.log(e)
      res = e
    }
    return res;
  }

  /**
   *
   * @param {*} location
   */
  async ReturnDisaster(location){
    var query_str = `SELECT * from disasters WHERE location='${JSON.stringify(location)}';`;
    let res;
    try{
      res = await this.pool.query(query_str);
      res = res.rows
    } catch(e){
      res = e
    }
    return res[0]
  }
  /**
   *
   * @param {*} name
   * @param {*} type
   * @param {*} keywords
   */
  async AddItem(name,type,keywords){
    var queryformat_keywords = keywords.length === 0 ? "" : "\"" + keywords.join("\",\"") + "\"";
    var query_str = `insert into items (name,type,keywords)
    VALUES(
        '${name}',
        '${type}',
        '[${queryformat_keywords}]')`;
    // console.log(query_str)
    await this.pool.query(query_str)
      .then(res=>console.log(/*res*/"item insert"))
  }

  /**
   * Gets an items information by item_id
   * @param {*} item_id 
   */
  async GetItem(item_id){
    var query_str = `SELECT * FROM items WHERE item_id='${item_id}'`
    let res;
    try{
      res = await this.pool.query(query_str);
      res = res.rows[0]
    }catch(e){
      res = e
    }
    return res;
  }
  /**
   * Here you can search for an item based on a pattern in the name
   * @param {*} pattern
   */
  async SearchItemContains(pattern){
    let res;
    const query_str = `SELECT * FROM items WHERE NAME like '%${pattern}%'`;
    try{
      res = await this.pool.query(query_str);
      res = res.rows;
    } catch(e){
      res = false;
    }
    return res;
  }

  /**
   * Here you can search for an item based on a pattern in the name
   * @param {*} pattern
   */
  async SearchItemStartsWith(pattern){
    let res;
    const query_str = `SELECT * FROM items WHERE NAME like '${pattern}%'`;
    try{
      res = await this.pool.query(query_str);
      res = res.rows;
    } catch(e){
      res = false;
    }
    return res;
  }


  /**
   *
   * @param {string} name This is the name of the disaster. Field can be null
   * @param {JSON} location JSON representation of user's address. This may vary between countries. Example:
    {
    "Address":"123 Example",
    "Country":"United States",
    "State":"Florida",
    "City":"Orlando",
    "Zipcode":32862
    }
   * @param {JSON} keywords JSON representation of keywords of items needed
   * {
   *  "type":["fire","hurricane"],
   *  "items_needed":["towels","food","cleaning"]
   * }
   */
  async AddDisaster(name,location,keywords){
    //check if disaster already has a disaster at the given location
    console.log(name)
    console.log(location)
    console.log(keywords)
    var query_str = `SELECT keywords FROM disasters where location='${JSON.stringify(location)}';`
    var exists = await this.pool
      .query(query_str)
      .then(res=>{
        //return false if no disaster at currently location
        // console.log(res.rows.isEmpty())
        if (res.rows.length < 1){
          return false
        } else{
          //get row w/ location
          const res_types = res.rows[0]['keywords'].type;
          const in_types = keywords.type;

          //values in keywords that are not in db
          let difference = in_types.filter(x => !res_types.includes(x));

          //create unique array
          const distinct = (value, index, self)=>{
            return self.indexOf(value) === index;
          };

          const concat_types = res_types.concat(in_types);
          // console.log(concat_types);
          const unique_types = concat_types.filter(distinct);

          //check if keywords match the input keywords
          var queryformat_types = unique_types.length === 0 ? "" : "\"" + unique_types.join("\",\"") + "\"";
          query_str = `UPDATE disasters SET keywords=jsonb_set(keywords,'{type}','[${queryformat_types}]') WHERE location='${JSON.stringify(location)}';`
          // console.log(query_str);

          this.pool
            .query(query_str)
        }
      });
      console.log(exists)
    if (exists === false){
      query_str = `INSERT INTO disasters (name,location,keywords) VALUES( '${name}',
      '${JSON.stringify(location)}',
    '${JSON.stringify(keywords)}');`;

      // console.log(query_str);
      this.pool
        .query(query_str)
        .then(res => console.log("disaster insert"))
        .catch(e => {
          console.error(e.detail)
          // this.pool.query("SELECT * FROM USERS;")
          //     .then(res_2 => console.log(res_2.rows))
        })
    }
  }

  /**
   * Gets all disasters from the table
   */
  async getAllDisasters(){
    var query_str = `SELECT * FROM DISASTERS;`;
    let disasters = await this.pool.query(query_str);

    return disasters.rows;
  }

  /**
   * Check if given email and password combination matches db archives
   * @param {string} email Search db for email user
   * @param {string} pword Match password (unencryption)
   * @param {string} key Encryption key to compare password
   * @returns {JSON} Return boolean if
   */
  async VerifyUser(email, pword){
    var query_str = `SELECT PASSWORD FROM USERS where email='${email}'`;
    let golden_pw_enc;
    let res = {access:false};
    try{
      golden_pw_enc = await this.pool.query(query_str);
      golden_pw_enc = golden_pw_enc.rows[0].password;
      //console.log(golden_pw_enc)
      if(bcrypt.compareSync(pword,golden_pw_enc)){
        // console.log("Access Granted... In theory");
        query_str = `SELECT isadmin FROM USERS where email='${email}'`;
        let isAdmin = await this.pool.query(query_str);
        isAdmin =  isAdmin.rows[0].isadmin;

        query_str = `SELECT isdonor FROM USERS where email='${email}'`;
        let isDonor = await this.pool.query(query_str);
        isDonor =  isDonor.rows[0].isdonor;

        query_str = `SELECT isrequester FROM USERS where email='${email}'`;
        let isRequester = await this.pool.query(query_str);
        isRequester =  isRequester.rows[0].isrequester;

        // console.log('isAdmin DB: ' + isAdmin)
        res = {
          "access": true,
          "isAdmin": isAdmin,
          "isDonor": isDonor,
          "isRequester": isRequester,
        };
      } else{
          // console.log("Error: Password does not match");
          res = {
            "access": false,
            "failure_reason": "password"
          };
      }
    } catch(e){
      //aconsole.log(e)
      res = {"access":false, "failure_reason":"email"};
    }
    return res;
  }

  /**
  * Registers new user in DB.
  *
  * @param {string} fname The first name of the user.
  * @param {string} lname The last name of the user.
  * @param {string} pword The unencrypted password of the user. Needs to be encrypted.
  * @param {string} email The email of the user
  * @param {JSON} location JSON representation of user's address. This may vary between countries. Example:
  {
  "Address":"123 Example",
  "Country":"United States",
  "State":"Florida",
  "City":"Orlando",
  "Zipcode":32862
  }
  * @param {Boolean} isAdmin This will be true if user is an admin (else false).
  */
  async NewUser( fname,lname,pword,email,location,isAdmin,isDon,isReq){
    var enc_pword = await bcrypt.hash(pword,10);
    let user_id;
    let res;
    var query_str = `INSERT INTO Users (First_Name, Last_Name, Email, Password, Location, isadmin,isDonor,isRequester)
    VALUES( '${fname}',
            '${lname}',
            '${email}',
            '${enc_pword}',
            '${JSON.stringify(location)}',
            '${isAdmin}',
            '${isDon}',
            '${isReq}');`;
    // console.log(query_str);
    try{
      //attempt insert
      res = await this.pool.query(query_str);
      // console.log(`New User: Original Result ${JSON.stringify(res)}`);

      //successful insert of new user
      query_str = `SELECT user_id FROM USERS WHERE EMAIL = '${email}';`;
      res = await this.pool.query(query_str);
      user_id = res.rows[0].user_id;
      console.log(user_id);
      if(isReq){
        query_str = `INSERT INTO REQUESTERS(user_id) VALUES(${user_id});`;
        await this.pool.query(query_str);
      }

      if(isDon){
        query_str = `INSERT INTO DONORS(user_id) VALUES(${user_id});`;
        await this.pool.query(query_str);
      }
    } catch(e){
      console.error(e);
    }


    // this.pool
    //     .query(query_str)
    //     .then(res => {
    //       console.log(`New User: Original Result ${res}`);
    //       //successful insert of new user
    //       user_id = await this.pool.query(`SELECT user_id FROM USERS WHERE EMAIL='${email};'`);
    //       console.log(`-----------\nNew User: User ID Result ${user_id}`);
    //       try{
    //         if(isReq){
    //           query_str = `INSERT INTO REQUESTERS(user_id) VALUES(${user_id});`
    //           this.pool.query(query_str);
    //         }

    //         if(isDon){
    //           query_str = `INSERT INTO DONORS(user_id) VALUES(${user_id});`
    //           this.pool.query(query_str);
    //         }
    //       }
    //       catch(e){
    //         console.error(e);
    //       }


    //     })
    //     .catch(e => {
    //         console.error(e.detail)
    //         this.pool.query("SELECT * FROM USERS;")
    //             // .then(res_2 => console.log(res_2.rows))
    //     })
  }

  /**
   * Gets a user with the given email
   * @param {string} email email of the requested user
   * @returns {object} with properties of user
   */
  async GetUser(email){
    var query_str = `SELECT * FROM USERS WHERE EMAIL = '${email}'`;
    let res = await this.pool.query(query_str);
    return res.rows[0];
  }

  /**
   * Drops a user from the table with the given email
   * @param {string} email email of the user to be droppedd
   */
  async DropUser(email){
    let user = await this.GetUser(email);
    let id = user.user_id;

    if(user.isdonor){
      var query_str = `DELETE FROM DONORS WHERE USER_ID = '${id}'`;
      let res = await this.pool.query(query_str);
    }
    
    if(user.isrequester){
      var query_str = `DELETE FROM REQUESTERS WHERE USER_ID = '${id}'`;
      let res = await this.pool.query(query_str);
    }

    var query_str = `DELETE FROM USERS WHERE EMAIL = '${email}'`;
    let res = await this.pool.query(query_str);
  }

  /**
   * Adds the token to the users entry by searching with the provoided email
   * @param {string} email email of the user to associate with token
   * @param {string} token token to assosciate with the user
   */
  async StoreToken(email, token){
    //console.log('Store: ' + email + ' ' + token)
    var query_str = `UPDATE USERS SET TOKEN = '${token}' WHERE EMAIL = '${email}'`;
    let res = await this.pool.query(query_str);
  }

  /**
   * Finds the user by email and enesures the token stored matches the token providedd
   * @param {string} email email of the user to validate with token
   * @param {string} token token to validate with user
   * @returns {boolean} true if token and user match false if not
   */
  async ValidateToken(email, token){
    //console.log('Validate: ' + email + ' ' + token)
    var query_str = `SELECT TOKEN FROM USERS WHERE EMAIL = '${email}'`;
    let res = await this.pool.query(query_str);
    let retreivedToken = res.rows[0].token;
    //console.log('Validate ' + retreivedToken)
    return token === retreivedToken;
  }

  /**
   * First validates the token is associated with the user then deletes it
   * @param {string} email of the user that is logging out and wanted the token deleted
   * @param {string} token token that needs to be deleted
   * @returns {boolean} true if delete was successful false if not
   */
  async RemoveToken(email, token){
    var query_str = `UPDATE USERS SET TOKEN = '' WHERE EMAIL = '${email}'`;
    if(this.ValidateToken(email, token)){
      let res = await this.pool.query(query_str);
      return true;
    }
    return false;
  }

  async InitializeDB(){
    var query_str = `
        DROP TABLE users, requesters, items, Donors, donations, requests, disasters;

        CREATE TABLE Users (
          User_ID SERIAL UNIQUE PRIMARY KEY NOT NULL,
          First_Name varchar(255) NOT NULL,
          Last_Name varchar(255) NOT NULL,
          Email varchar(255) UNIQUE NOT NULL,
          Password varchar(255) NOT NULL,
          Location jsonb,
          isAdmin bool Default false,
          isRequester bool Default false,
          isDonor bool Default false,
          token varchar(255) Default ''
        );

        CREATE TABLE Donors (
          User_ID SERIAL UNIQUE NOT NULL,
          Donor_ID SERIAL PRIMARY KEY NOT NULL
        );

        CREATE TABLE Items (
          Item_ID SERIAL PRIMARY KEY NOT NULL,
          Name varchar(255) Unique NOT NULL,
          Type varchar(255) NOT NULL,
          Keywords jsonb
        );

        CREATE TABLE Disasters (
          Disaster_ID SERIAL PRIMARY KEY NOT NULL,
          -- Type varchar(255) NOT NULL,
          Name varchar(255) NOT NULL,
          Keywords jsonb,
          Location jsonb
        );

        CREATE TABLE Requesters (
          Requester_ID SERIAL PRIMARY KEY NOT NULL,
          User_ID SERIAL NOT NULL
        );

        CREATE TABLE Requests (
          Request_ID SERIAL PRIMARY KEY NOT NULL,
          Requester_ID SERIAL NOT NULL,
          Disaster_ID SERIAL NOT NULL,
          Item_ID SERIAL NOT NULL,
          Num_Needed integer NOT NULL,
          Num_Provided integer Default 0 NOT NULL
        );

        CREATE TABLE Donations (
          Donation_ID SERIAL PRIMARY KEY NOT NULL,
          Request_ID SERIAL NOT NULL,
          Disaster_ID SERIAL NOT NULL,
          Item_ID SERIAL NOT NULL,
          Quantity integer NOT NULL,
          Donor_ID SERIAL NOT NULL
        );

        ALTER TABLE Donors ADD FOREIGN KEY (User_ID) REFERENCES Users (User_ID);

        ALTER TABLE Requesters ADD FOREIGN KEY (User_ID) REFERENCES Users (User_ID);

        ALTER TABLE Requests ADD FOREIGN KEY (Requester_ID) REFERENCES Requesters (Requester_ID);

        ALTER TABLE Requests ADD FOREIGN KEY (Disaster_ID) REFERENCES Disasters (Disaster_ID);

        ALTER TABLE Requests ADD FOREIGN KEY (Item_ID) REFERENCES Items (Item_ID);

        ALTER TABLE Donations ADD FOREIGN KEY (Disaster_ID) REFERENCES Disasters (Disaster_ID);

        ALTER TABLE Donations ADD FOREIGN KEY (Item_ID) REFERENCES Items (Item_ID);

        ALTER TABLE Donations ADD FOREIGN KEY (Donor_ID) REFERENCES Donors (Donor_ID); 
    `
    let res = await this.pool.query(query_str);
  }

  Disconnect(){
    this.pool.end()
  }
}
module.exports = dbApi;
