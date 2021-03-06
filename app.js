var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var dateFormat = require('dateformat');
const cors = require('cors')
const db = require("./db");
const uuidv1 = require('uuid/v1');
const schema = process.env.SCHEMA;
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://39cd071f77f34837ad6c930c5c7fc322@sentry.io/1987793' });

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.enable('trust proxy');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(express.static(__dirname + '/public'));
var whitelist = process.env.ENV_URL
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

/*=========================*/
/*====== GET Routes =======*/
/*=========================*/
app.get('/', async function(req, res, next) {
  var id = req.query.id; 
  var langBU = req.query.langBU;

  try{
    if(id && langBU){
      var split = langBU.split('-');
      var lang = split[0];
      var bu = split[1];
      // get correct package configuration
      const packageConfig = await db.query("SELECT * FROM "+schema+".ncpc__PC_Package_Configuration__c WHERE ncpc__parameter__c = '"+langBU+"'");
      // get Business unit langauge records to identify what languages to show in drop down
      const languages = await db.query("SELECT * FROM "+schema+".ncpc__BusinessUnit_Language__c WHERE ncpc__Business_Unit_Parameter__c = '"+bu+"'");

      console.log(packageConfig.rows,languages.rows);

      res.render('index', {
        config: packageConfig.rows,
        languages: languages.rows
      });
    }else{
      res.render('error', {});
    }
  } catch (err) {
    return next(err);
  }
})

app.get('/error', async function(req, res, next) {
  res.render('error', {});
})

app.get('/maintenance', async function(req, res, next) {
  res.render('error', {});
})

//app.get('/subscriptions', cors(corsOptions), async function(req, res, next) {
app.get('/subscriptions', async function(req, res, next) {
  var id = req.query.id; 
  var langBU = req.query.langBU;

  try{
    let leadOrContact = id.substring(0,3) == '003' ? 'sub.ncpc__Contact__c' : 'sub.ncpc__Lead__c';
    var split = langBU.split('-');
    var lang = split[0];
    var bu = split[1];
    var variantLangBUClause = lang === '' ? "variant.ncpc__Default_Variant__c = 'true' AND variant.ncpc__Business_Unit_Parameter__c = '"+bu+"'" : "variant.ncpc__Parameter__c = '"+ langBU +"'";
    var catLangBUClause = lang === '' ? "cat.ncpc__Default_Variant__c = 'true' AND cat.ncpc__Business_Unit_Parameter__c = '"+bu+"'" : "cat.ncpc__Parameter__c = '"+ langBU +"'";

    //const avails = await db.query("SELECT *, avail.sfid as availableSubId, (SELECT sub.ncpc__Opt_In__c FROM "+schema+".ncpc__PC_Subscription__c as sub WHERE " + leadOrContact + " = '" + id + "' AND avail.sfid = sub.ncpc__Related_Subscription_Interest__c) as OptInState, (SELECT sfid as userSubId FROM "+schema+".ncpc__PC_Subscription__c as sub WHERE " + leadOrContact + " = '" + id + "' AND avail.sfid = sub.ncpc__Related_Subscription_Interest__c) as userSubId, (SELECT cat.ncpc__Display_Category_Text__c FROM "+schema+".ncpc__Category_Variant__c as cat WHERE avail.ncpc__CategoryId__c = cat.ncpc__Category__c AND "+ catLangBUClause +") as CategoryName FROM "+schema+".ncpc__PC_Available_Subscription_Interest__c as avail INNER JOIN "+schema+".ncpc__Available_Subscription_Variant__c as variant ON avail.sfid = variant.ncpc__Available_Subscription_Interest__c LEFT JOIN "+schema+".campaign as campaign ON avail.sfid = campaign.ncpc__Related_Subscription__c WHERE avail.ncpc__Status__c = true AND avail.ncpc__Type__c = 'Subscription' AND "+ variantLangBUClause +" ORDER BY avail.ncpc__order__c");
    const avails = await db.query("SELECT *, avail.sfid as availableSubId, (SELECT sub.ncpc__Opt_In__c FROM "+schema+".ncpc__PC_Subscription__c as sub WHERE " + leadOrContact + " = '" + id + "' AND avail.sfid = sub.ncpc__Related_Subscription_Interest__c) as OptInState, (SELECT sfid as userSubId FROM "+schema+".ncpc__PC_Subscription__c as sub WHERE " + leadOrContact + " = '" + id + "' AND avail.sfid = sub.ncpc__Related_Subscription_Interest__c) as userSubId, (SELECT cat.ncpc__Display_Category_Text__c FROM "+schema+".ncpc__Category_Variant__c as cat WHERE avail.ncpc__CategoryId__c = cat.ncpc__Category__c AND "+ catLangBUClause +") as CategoryName FROM "+schema+".ncpc__PC_Available_Subscription_Interest__c as avail INNER JOIN "+schema+".ncpc__Available_Subscription_Variant__c as variant ON avail.sfid = variant.ncpc__Available_Subscription_Interest__c WHERE avail.ncpc__Status__c = true AND avail.ncpc__Type__c = 'Subscription' AND "+ variantLangBUClause +" ORDER BY avail.ncpc__order__c");
    //const groupedAvailsOnId = groupBySubscription(avails.rows, 'availableSubId');

    const groupedAvails = groupBySubscription(avails.rows, 'ncpc__display_category__c');

    res.render('subscriptions', {
      subscriptions: groupedAvails
    });
  } catch (err) {
    return next(err);
  }
})

app.get('/interests', async function(req, res, next) {
  var id = req.query.id; 
  var langBU = req.query.langBU;

  try{
    let leadOrContact = id.substring(0,3) == '003' ? 'int.ncpc__Contact__c' : 'int.ncpc__Lead__c';
    var split = langBU.split('-');
    var lang = split[0];
    var bu = split[1];
    var variantLangBUClause = lang === '' ? "variant.ncpc__Default_Variant__c = 'true' AND variant.ncpc__Business_Unit_Parameter__c = '"+bu+"'" : "variant.ncpc__Parameter__c = '"+ langBU +"'";
    var catLangBUClause = lang === '' ? "cat.ncpc__Default_Variant__c = 'true' AND cat.ncpc__Business_Unit_Parameter__c = '"+bu+"'" : "cat.ncpc__Parameter__c = '"+ langBU +"'";

    const avails = await db.query("SELECT *, avail.sfid as availableIntId, (SELECT int.ncpc__selected__c FROM "+schema+".ncpc__PC_Interest__c as int WHERE " + leadOrContact + " = '" + id + "' AND avail.sfid = int.ncpc__interest_selected__c) as OptInState, (SELECT sfid as userSubId FROM "+schema+".ncpc__PC_Interest__c as int WHERE " + leadOrContact + " = '" + id + "' AND avail.sfid = int.ncpc__Interest_Selected__c) as userIntId, (SELECT cat.ncpc__Display_Category_Text__c FROM "+schema+".ncpc__Category_Variant__c as cat WHERE avail.ncpc__CategoryId__c = cat.ncpc__Category__c AND "+ catLangBUClause +") as CategoryName FROM "+schema+".ncpc__PC_Available_Subscription_Interest__c as avail INNER JOIN "+schema+".ncpc__Available_Subscription_Variant__c as variant ON avail.sfid = variant.ncpc__Available_Subscription_Interest__c WHERE avail.ncpc__Status__c = true AND avail.ncpc__Type__c = 'Interest' AND "+ variantLangBUClause +" ORDER BY avail.ncpc__order__c");
    
    const groupedAvails = groupByInterest(avails.rows, 'ncpc__display_category__c');

    res.render('interests', {
      interests: groupedAvails
    });
  } catch (err) {
    return next(err);
  }
})

app.get('/profiles', async function(req, res, next) {
  var id = req.query.id; 
  var langBU = req.query.langBU;

  try{
    let leadOrContact = id.substring(0,3) == '003' ? 'contact' : 'lead';
    var split = langBU.split('-');
    var lang = split[0];
    var bu = split[1];
    var variantLangBUClause = lang === '' ? "variant.ncpc__Default_Variant__c = 'true' AND variant.ncpc__Business_Unit_Parameter__c = '"+bu+"'" : "variant.ncpc__Parameter__c = '"+ langBU +"'";
    var vpOptionLangBUClause = lang === '' ? "pvOption.ncpc__Default_Variant__c = 'true' AND pvOption.ncpc__Business_Unit_Parameter__c = '"+bu+"'" : "pvOption.ncpc__Parameter__c = '"+ langBU +"'";

    const profile = await db.query("SELECT prof.sfid as profid, prof.ncpc__Field_Type__c as fieldType, prof.ncpc__Editable__c as disabled, prof.ncpc__Order__c as order, variant.ncpc__Field_Text__c as label, variant.ncpc__Field_Placeholder_Text__c as placeholder, pOption.ncpc__Order__c as optionorder, pvOption.ncpc__Value__c as optionlabel, pOption.sfid as optionid, * FROM "+schema+".ncpc__PC_Profile_Field__c as prof INNER JOIN "+schema+".ncpc__Profile_Field_Variant__c as variant ON prof.sfid = variant.ncpc__profile_field__c LEFT JOIN "+schema+".ncpc__PC_Profile_Option__c as pOption ON prof.sfid = pOption.ncpc__Profile_Field__c LEFT JOIN "+schema+".ncpc__profile_option_variant__c as pvOption ON pOption.sfid = pvOption.ncpc__profile_option__c AND "+vpOptionLangBUClause+" WHERE prof.ncpc__Status__c = true AND "+variantLangBUClause+" ORDER BY prof.ncpc__order__c");
    var profileRows = profile.rows;

    const groupedProfile = groupByProfile(profileRows, 'ncpc__'+leadOrContact+'_mapped_field__c');
    var profileArray = groupedProfile.map(groupedProfile => groupedProfile.mappedField).join(',');

    const user = await db.query("SELECT "+profileArray+" FROM "+schema+"."+leadOrContact+" WHERE sfid = '"+id+"'");

    var fieldKeys = Object.keys(user.rows[0])
    for (var i=0; i<fieldKeys.length; i++) {
      var fieldValue = user.rows[0][fieldKeys[i]];
      var getField = groupedProfile.find(field => field.mappedField.toLowerCase() === fieldKeys[i]);
      if(getField){
        getField['value'] = fieldValue;
      }
    }
    res.render('profile', {
      profile: groupedProfile
    });

  } catch (err) {
    return next(err);
  }
})

/*==========================*/
/*====== POST Routes =======*/
/*==========================*/

app.post("/subscription", async function(req, res, next) {
  var customerSubId = req.body.customerSubId;
  var availableSubId = req.body.availableSubId;
  var value = req.body.value;
  var id = req.body.id; 
  var today = dateFormat(new Date(), "yyyy-mm-dd");

  try {
    let leadOrContact = id.substring(0,3) == '003' ? 'ncpc__Contact__c' : 'ncpc__Lead__c';
    if(availableSubId && id){
      if(customerSubId){
        const subs = await db.query("SELECT * FROM "+schema+".ncpc__PC_Subscription__c WHERE sfid = '" + customerSubId + "'");
        var externalKey = subs.rows[0].ncpc__external_id__c === '' ? uuidv1() : subs.rows[0].ncpc__external_id__c;
        var dateField = value === 'true' ? 'ncpc__Opt_In_Date__c' : 'ncpc__Opt_Out_Date__c';
        // Subscription exists, update existing
        const result = await db.query(
          "UPDATE "+schema+".ncpc__PC_Subscription__c SET "+dateField+"=$1, ncpc__Opt_In__c=$2, ncpc__subscription_type__c=$3, ncpc__External_Id__c=$4 WHERE sfid=$5 RETURNING *",
          [today, value, 'Expressed', externalKey, customerSubId]
        );
        res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
      }else{
        // Net new Subscription, create record
        const result = await db.query(
          "INSERT INTO "+schema+".ncpc__PC_Subscription__c ("+leadOrContact+",ncpc__Related_Subscription_Interest__c,ncpc__Subscription_Type__c,ncpc__Opt_In_Date__c,ncpc__Initial_Opt_In_Date__c,ncpc__Opt_In_Source__c,ncpc__Opt_In__c, ncpc__External_Id__c) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [id, availableSubId, 'Expressed', today, today, 'Preference Center', value, uuidv1()]
        );
        res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
      }
      }else{
        console.log("Subscription Post - Missing Required Data: " + JSON.stringify(req.body));
        res.json({"success":"fail","status":402,"message":"Missing required data","body":req.body});
      }
  } catch (e) {
    console.log("Post Log Error: " + JSON.stringify(e));
    res.json({"success":"fail","status":401,"message":"Error Occured","body":e});
  }
});

app.post('/profile', async function(req, res, next) {
  var field = req.body.field;
  var value = req.body.value;
  var id = req.body.id; 

  try{
    let leadOrContact = id.substring(0,3) == '003' ? 'Contact' : 'Lead';
    if(id && field && value){
      const updateProfile = await db.query(
        "UPDATE "+schema+"."+leadOrContact+" SET "+field+"=$1 WHERE sfid=$2 RETURNING *",
        [value, id]
      );
      res.json({"success":true,"status":200,"message":"Update Successful","body":updateProfile.rows});
    }else{
      console.log("Profile Post - Missing Required Data: " + JSON.stringify(req.body));
      res.json({"success":"fail","status":402,"message":"Missing required data","body":req.body});
    }
  }catch(e){
    console.log("Post Log Error: " + JSON.stringify(e));
    res.json({"success":"fail","status":401,"message":"Error Occured","body":e});
  }
});

app.post('/interest', async function(req, res, next) {
  var customerIntId = req.body.customerIntId;
  var availableIntId = req.body.availableIntId;
  var value = req.body.value;
  var id = req.body.id; 
  var today = dateFormat(new Date(), "yyyy-mm-dd");

  try {
    let leadOrContact = id.substring(0,3) == '003' ? 'ncpc__Contact__c' : 'ncpc__Lead__c';
    if(availableIntId && id){
      if(customerIntId){
        const subs = await db.query("SELECT * FROM "+schema+".ncpc__PC_Interest__c WHERE sfid = '" + customerIntId + "'");
        var externalKey = subs.rows[0].ncpc__external_id__c === '' ? uuidv1() : subs.rows[0].ncpc__external_id__c;
        // Interest exists, update existing
        if(externalKey){
          const result = await db.query(
            "UPDATE "+schema+".ncpc__PC_Interest__c SET ncpc__Captured_Date__c=$1, ncpc__Selected__c=$2 WHERE sfid=$3 RETURNING *",
            [today, value, customerIntId]
          );
          res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
        }else{
          const result = await db.query(
            "UPDATE "+schema+".ncpc__PC_Interest__c SET ncpc__Captured_Date__c=$1, ncpc__Selected__c=$2, ncpc__External_Id__c=$3 WHERE sfid=$4 RETURNING *",
            [today, value, externalKey, customerIntId]
          );
          res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
        }
      }else{
        // Net new Interest, create record
        const result = await db.query(
          "INSERT INTO "+schema+".ncpc__PC_Interest__c ("+leadOrContact+",ncpc__Interest_Selected__c,ncpc__Captured_Date__c,ncpc__Selected__c,ncpc__External_Id__c) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [id, availableIntId, today, value, uuidv1()]
        );
        res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
      }
    }else{
      console.log("Interest Post - Missing Required Data: " + JSON.stringify(req.body));
      res.json({"success":"fail","status":402,"message":"Error Occured","body":req.body});
    }
  } catch (e) {
    console.log("Post Log Error: " + JSON.stringify(e));
    res.json({"success":"fail","status":401,"message":"Error Occured","body":e});
  }
});

app.post('/log', async function(req, res, next) {
  var overallStatus = req.body.overallStatus;
  var errorMessage = req.body.errorMessage;
  var requestPayload = req.body.requestPayload;
  var endpoint = req.body.endpoint; 

  try{
    if(endpoint && overallStatus){
      const result = await db.query(
        "INSERT INTO "+schema+".ncpc__PC_Log__c (ncpc__overallStatus__c,ncpc__errorMessage__c,ncpc__requestPayload__c,ncpc__endpoint__c,ncpc__External_Id__c) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [overallStatus, errorMessage, requestPayload, endpoint, uuidv1()]
      );
      res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
    }else{
      console.log("Log Post - Missing Required Data: " + JSON.stringify(req.body));
      res.json({"success":"fail","status":402,"message":"Error Occured","body":req.body});
    }
  }catch(e){
    console.log("Post Log Error: " + JSON.stringify(e));
    res.json({"success":"fail","status":401,"message":"Error Occured","body":e});
  }
});

app.post('/unsubscribeAll', async function(req, res, next) {
  var id = req.body.id; 
  var today = dateFormat(new Date(), "yyyy-mm-dd");

  try{
    if(id){
      let leadOrContact = id.substring(0,3) == '003' ? 'ncpc__Contact__c' : 'ncpc__Lead__c';
      const subs = await db.query("SELECT * FROM "+schema+".ncpc__PC_Subscription__c WHERE "+leadOrContact+" = '" + id + "' AND ncpc__Opt_In__c = 'true'");

      if(subs.rows.length > 0){
        for (var i=0; i<subs.rows.length; i++) {
          var externalKey = subs.rows[i].ncpc__external_id__c === '' ? uuidv1() : subs.rows[i].ncpc__external_id__c;
          if(externalKey){
            const result = await db.query(
              "UPDATE "+schema+".ncpc__PC_Subscription__c SET ncpc__Opt_Out_Date__c=$1, ncpc__Opt_In__c=$2, ncpc__subscription_type__c=$3 WHERE "+leadOrContact+"=$4 RETURNING *",
              [today, 'false', 'Expressed', id]
            );
            if(i != subs.rows.length - 1 || subs.rows.length == 1){
              res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
            }
          }else{
            const result = await db.query(
              "UPDATE "+schema+".ncpc__PC_Subscription__c SET ncpc__Opt_Out_Date__c=$1, ncpc__Opt_In__c=$2, ncpc__External_Id__c=$3, ncpc__subscription_type__c=$4 WHERE "+leadOrContact+"=$5 RETURNING *",
              [today, 'false', externalKey, 'Expressed', id]
            );
            if(i != subs.rows.length - 1 || subs.rows.length == 1){
              res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
            }
          }
        }
      }else{
        res.json({"success":true,"status":200,"message":"No records to update","body":""});
      }
    }else{
      console.log("Unsubscribe All Post - Missing Required Data: " + JSON.stringify(req.body));
      res.json({"success":"fail","status":402,"message":"Error Occured","body":req.body});
    }
  }catch(e){
    console.log("Post UnsubscribeAll Error: " + JSON.stringify(e));
    res.json({"success":"fail","status":401,"message":"Error Occured","body":e});
  }
});

app.post('/campaignMember', async function(req, res, next) {
  var id = req.body.id; 
  var campaignMemberId = req.body.campaignMemberId;
  var value = req.body.value;
 
  try{
    if(id && campaignMemberId && value){
      // Update campaign member status 
      const result = await db.query(
        "UPDATE "+schema+".CampaignMember SET ncpc__Subscribed__c=$1 WHERE sfid=$2 RETURNING *",
        [value, campaignMemberId]
      );
      res.json({"success":true,"status":200,"message":"Update Successful","body":result.rows});
    }else{
      console.log("Campaign Member Post - Missing Required Data: " + JSON.stringify(req.body));
      res.json({"success":"fail","status":402,"message":"Error Occured","body":req.body});
    }
  }catch(e){
    console.log("Post Campaign Error: " + JSON.stringify(e));
    res.json({"success":"fail","status":401,"message":"Error Occured","body":e});
  }
});


/*========== Functions ===========*/

const groupByProfile = (objectArray, ...properties) => {
  return [...Object.values(objectArray.reduce((accumulator, object) => {
    const key = JSON.stringify(properties.map((x) => object[x] || null));

    if (!accumulator[key]) {
      accumulator[key] = {
        id: object['profid'],
        controlType: object['fieldtype'],
        label: object['label'],
        placeholder: object['placeholder'],
        disabled: object['disabled'],
        order: object['order'],
        value: object[''],
        mappedField: object[''+properties+''],
        options: []
      };
    }
    
    if(object['optionid']){
      const filteredObject = {
        id: object['optionid'],
        label: object['optionlabel'],
        order: object['optionorder']
      };
      
      accumulator[key].options.push(filteredObject);
    }

    return accumulator;
  }, {}))];
}

const groupByInterest = (objectArray, ...properties) => {
  return [...Object.values(objectArray.reduce((accumulator, object) => {
    const key = JSON.stringify(properties.map((x) => object[x] || null));

    if (!accumulator[key]) {
      accumulator[key] = {
        catcontrolType: 'formGroup',
        catid: object['ncpc__categoryid__c'],
        catlabel: object['categoryname'],
        catorder: object['ncpc__categoryorder__c'],
        interests: []
      };
    }
    
    const filteredObject = {
      userIntId: object['userintid'],
      availableIntId: object['availableintid'],
      controlType: 'checkbox',
      label: object['ncpc__display_text__c'],
      description: object['ncpc__display_description__c'],
      checked: object['optinstate'],
      disabled: object['ncpc__disabled__c'],
      order: object['ncpc__order__c'],
      url: object['ncpc__icon_url__c']
    };
    
    accumulator[key].interests.push(filteredObject);
    
    return accumulator;
  }, {}))];
}

const groupBySubscription = (objectArray, ...properties) => {
  return [...Object.values(objectArray.reduce((accumulator, object) => {
    const key = JSON.stringify(properties.map((x) => object[x] || null));

    if (!accumulator[key]) {
      accumulator[key] = {
        catcontrolType: 'formGroup',
        catid: object['ncpc__categoryid__c'],
        catlabel: object['categoryname'],
        catorder: object['ncpc__categoryorder__c'],
        subscriptions: []
      };
    }
    
    const filteredObject = {
      userSubId: object['usersubid'],
      availableSubId: object['availablesubid'],
      controlType: 'switch',
      label: object['ncpc__display_text__c'],
      checked: object['optinstate'],
      description: object['ncpc__display_description__c'],
      channel: object['ncpc__channel__c'],
      disabled: object['ncpc__disabled__c'],
      public: object['ncpc__public__c'],
      order: object['ncpc__order__c'],
      campaigns: []
    };
    
    accumulator[key].subscriptions.push(filteredObject);
    
    return accumulator;
  }, {}))];
}

const groupBySubscriptionCampaign = (objectArray, ...properties) => {
  return [...Object.values(objectArray.reduce((accumulator, object) => {
    const key = JSON.stringify(properties.map((x) => object[x] || null));

    if (!accumulator[key]) {
      accumulator[key] = {
        catcontrolType: 'formGroup',
        catid: object['ncpc__categoryid__c'],
        catlabel: object['categoryname'],
        catorder: object['ncpc__categoryorder__c'],
        subscriptions: []
      };
    }
    
    const filteredObject = {
      userSubId: object['usersubid'],
      availableSubId: object['availablesubid'],
      controlType: 'switch',
      label: object['ncpc__display_text__c'],
      checked: object['optinstate'],
      description: object['ncpc__display_description__c'],
      channel: object['ncpc__channel__c'],
      disabled: object['ncpc__disabled__c'],
      public: object['ncpc__public__c'],
      order: object['ncpc__order__c'],
      campaigns: []
    };
    
    accumulator[key].subscriptions.push(filteredObject);
    
    return accumulator;
  }, {}))];
}

app.listen(process.env.PORT || 5000);