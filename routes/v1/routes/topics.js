var mongoose = require('mongoose');
var express = require('express');
var router = express.Router();


// path /v1/


/* GET all topics */
router.get('/', function(req, res, next) {
    var db = require('../db/db');

    var limit = 250;
    if (typeof(req.query.limit) !== "undefined"){
        limit = req.query.limit;
        limit = parseInt(limit);
    }
    if (limit > 250){
        limit = 250;
    }

    var page = 1;
    if (typeof(req.query.page) !== "undefined"){
        page = req.query.page;
        page = parseInt(page);
    }
    if (page < 1){
        page = 1;
    }

    var q = {};

    if (typeof(req.query.parent_id) !== "undefined"){

        var pid = (req.query.parent_id == "-1") ? null : req.query.parent_id;
        q['parent_id'] = pid;
    }

    if (typeof(req.query.name) !== "undefined"){
        var name = req.query.name;
        q['name'] = name;
    }

    if (typeof(req.query.id) !== "undefined"){
        q['_id'] = mongoose.Types.ObjectId(req.query.id);
    }

    db.Topic.getAll(q, limit, page, req.user, function(err, results){
        var log = require('npmlog');
        if (err){
            log.error("Error finding ", err);
            res.status(500);
            res.json(err);
            return;
        }
        res.status(200);
        console.log ("Done get all");
        res.json(results);
        return;
    });


});

//create a new topic
router.post("/", function(req, res, next){
    var db = require('../db/db');
    var config = require('config');

    var topic = new db.Topic;

    var log = require('npmlog');

    topic.name = req.body.name;
    topic.contributors.push(req.user.id);
    topic.subscribers.push(req.user.id);

    var groups = req.user && req.user.groups ? req.user.groups.slice() : [];

    if (typeof(req.body.parent_id) !== "undefined"){
        try{
            topic.parent_id = mongoose.Types.ObjectId(req.body.parent_id);
        }catch(ex){}
    }

    if (config.has('requiredRoleToCreateTopic')){
        var reqRole = config.get('requiredRoleToCreateTopic');

        if (reqRole.indexOf(', ') !== -1){
            reqRole = reqRole.split(", ");
        }
        if (reqRole.indexOf(",") !== -1){
            reqRole = reqRole.split(",");
        }

        var reqIndex = -1;
        let hadRequiredRole = false;

        if (Array.isArray(reqRole)){
            
            for (let i=0; i<reqRole.length; i++){
                reqIndex = groups.indexOf(reqRole[i]);
                if (reqIndex !== -1){
                    hadRequiredRole = true;
                    groups.splice(reqIndex, 1);
                }
            }

            reqIndex = -1;
        }else{
            reqIndex = req.user && req.user.groups ? req.user.groups.indexOf(reqRole) : -1;
        }

        if (reqIndex===-1 && !hadRequiredRole){
            log.error('User ' + req.user.id + " tried to create a topic but lacks required role: " + reqRole);
            res.status(401);
            res.json({error: "Lack required role to create a topic"}).status(401);
            return;
        }else if (reqIndex !== -1){
            groups.splice(reqIndex, 1);
        }

    }

    var ignoreGroups = config.has('ignoreGroupsFromConsideration') ? config.get('ignoreGroupsFromConsideration') : [];
    for (var i=0; i<ignoreGroups.length; i++){
                                                 
        if ( (ignoreGroups[i].indexOf("/") == 0) && (ignoreGroups[i].lastIndexOf("/") === (ignoreGroups[i].length -1)) ){
             let s = ignoreGroups[i].substring(1, ignoreGroups[i].length-1);
             let r = new RegExp(s);      
            groups = groups.filter( (el) => {
                //console.log("REGEX match", el, s, r, el.match(r));
                return el.match(r) === null })
        }else{
            var ignoreIndex = -1;
            ignoreIndex = groups.indexOf(ignoreGroups[i]);
            if (ignoreIndex !== -1){
                groups.splice(ignoreIndex, 1);
            }
        }
        
    }

    topic.author_groups = groups;

    log.debug("Creating topic: ", topic);

    if (topic.parent_id !== null){
        db.Topic.find({_id: topic.parent_id}, function(err, resList){
            log.debug("Topic find one", resList, err);
            if (err || resList==null || resList.length === 0){
                res.status(400);
                res.json({error: "No such parent topic"});
                return;
            }
            var result = resList[0];

            if ((typeof(result.parent_id) !== "undefined") && (result.parent_id !== null)){
                res.status(400);
                res.json({error: "Currently the api only supports nesting 1 topic level"});
                return;
            }

            topic.save(function(saveErr, saveRes){
                if (saveErr){
                    res.status(500);
                    res.json({error: saveErr});
                    return;
                }
                var messages = require('../messages/messages');
                messages.sendTopicMessage(topic);
                res.json({message: "Successfully written", _id: saveRes._id, result: saveRes});
            });
        });
    }else{
        topic.save(function(saveErr, saveRes){
            if (saveErr){
                res.status(500);
                res.json({error: saveErr});
                return;
            }
            var messages = require('../messages/messages');
            messages.sendTopicMessage(topic);
            res.json({message: "Successfully written", _id: saveRes._id, result: saveRes});
        });
    }
});

router.delete('/:topicId', function(req, res){
    var db = require('../db/db');
    var logger = require('npmlog');
    var topicId = mongoose.Types.ObjectId(req.params.topicId);
    var config = require('config');
    var adminGroup = config.has('adminGroup') ? config.get('adminGroup') : false;

    db.Topic.getAll({_id: topicId}, 1, 1, req.user, function(topicErr, topicRes) {
        if (topicErr || !topicRes || topicRes.length <= 0){
            res.status(500);
            res.json({error: topicErr.message});
            return;
        }

        topicRes = topicRes[0];

        if ( (adminGroup && req.user && req.user.groups.indexOf(adminGroup) !== -1) || ((topicRes.contributors.length === 1) && (topicRes.contributors[0] === req.user.id)) ){

            db.Topic.deleteOne({_id: topicId}, function(err, result){
                if (err){
                    res.status(500);
                    res.json({error: err});
                    return;
                }

                db.Comment.deleteMany({topic_id: topicId}, function(deleteErr){
                    if (deleteErr){
                        logger.error("Error deleting comments: ", deleteErr)
                    }else {
                        logger.debug("Deleted all comments for the topic that was deleted");
                    }
                });

                res.json({message: "Record successfully deleted"});
            });

        }else{
            res.status(403);
            res.json({error: "You are either not an admin or tried to delete a topic that you are not the sole contributor of"});
        }


    });
});


router.put('/:topicId/subscribe', function(req, res){
    var db = require('../db/db');
    var subscribers = require('../subscribers/subscribers');
    var topicId = mongoose.Types.ObjectId(req.params.topicId);

    var userId = req.body.user_id;

    // .getAll() filters using permissions
    db.Topic.getAll({_id: topicId}, 1, 1, req.user, function(topicErr, topicRes) {
        if (topicErr || !topicRes || topicRes.length <= 0){
            res.status(500);
            res.json({error: topicErr.message});
            return;
        }

        subscribers.subscribe(topicId, userId, false, (err) => {
            if (err) {
                res.status(500);
                res.json({error: err.message});
                return;
            }
            res.json({message: "Topic subscriptions ok"});
        });
    });
});

router.put('/:topicId/unsubscribe', function(req, res){
    var db = require('../db/db');
    var subscribers = require('../subscribers/subscribers');
    var topicId = mongoose.Types.ObjectId(req.params.topicId);

    var userId = req.body.user_id;

    // .getAll() filters using permissions
    db.Topic.getAll({_id: topicId}, 1, 1, req.user, function(topicErr, topicRes) {
        if (topicErr || !topicRes || topicRes.length <= 0){
            res.status(500);
            res.json({error: topicErr.message});
            return;
        }

        subscribers.unsubscribe(topicId, userId, (err) => {
            if (err) {
                res.status(500);
                res.json({error: err.message});
                return;
            }
            res.json({message: "Topic subscriptions ok"});
        });
    });
});


module.exports = router;