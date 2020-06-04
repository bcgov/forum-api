var express = require('express');
var router = express.Router();


// path /v1/

/* GET all permissions */
router.get('/', function(req, res, next) {
    var db = require('../db/db');

    var mongoose = require('mongoose');
    var q = new mongoose.Query();

    var operand = (typeof(req.query.operand) !== "undefined") ? req.query.operand : "and";

    if (typeof(req.query.topic_id) !== "undefined"){
        q[operand]([{topic_id: req.query.topic_id}]);
    }

    if (typeof(req.query.comment_id) !== "undefined"){
        q[operand]([{comment_id: req.query.topic_id}]);
    }

    if (typeof(req.query.user_id) !== "undefined"){
        q[operand]([{user_id: req.query.user_id}]);
    }

    if (typeof(req.query.group_ids) !== "undefined"){
        var groups = req.query.group_ids.split(",");
        q[operand]([{group_ids: { $in: groups }}]);
    }

    db.Permission.find(q, function(err, results){
        var log = require('npmlog');
        if (err){
            log.error("Error finding ", err);
            res.status(500);
            res.json(err);
            return;
        }
        res.json(results);
    });
});

//Update permission NOTE THIS DOES NOT VALIDATE given topic or comment ids.
//NOTE that the allow flag does matter, but it is implied to be allow true for topics and allow false for comments
router.put("/:id", function(req, res, next){
    var db = require('../db/db');
    var log = require('npmlog');
    var mongoose = require('mongoose');
    mongoose.set('useFindAndModify', false);

    var id = mongoose.Types.ObjectId(req.params.id);

    var config = require('config');
    var adminGroup = config.get('adminGroup')

    if (req.user.groups.indexOf(adminGroup) === -1){
        res.status(403);
        return res.json({error: "Forbidden"});
    }

    db.Permission.find({_id: id}, function(err, results){
        if (results.length == 0){
            res.status(400);
            return res.json({error: "No such permission"})
        }
        if (results.length > 1){
            res.status(400);
            return res.json({error: "Too many permissions matched"})
        }

        var permission = {};


        permission.priority = (typeof(req.body.priority) !== "undefined") ? req.body.priority : results[0].priority;
        
        permission.allow = (typeof(req.body.allow) !== "undefined") ? req.body.allow : results[0].allow;

        permission.topic_id = (typeof(req.body.topic_id) !== "undefined") ? req.body.topic_id : results[0].topic_id ;
        permission.comment_id = (typeof(req.body.comment_id) !== "undefined") ? req.body.comment_id : results[0].comment_id ;
        permission.user_ids = (typeof(req.body.user_ids) !== "undefined") ? req.body.user_ids : results[0].user_ids ;
        permission.group_ids = (typeof(req.body.group_ids) !== "undefined") ? req.body.group_ids : results[0].group_ids ;

        log.debug("Updating permission: ", permission);

        db.Permission.findOneAndUpdate({_id: id}, { $set: permission }, function(saveErr, saveRes){
            if (saveErr){
                res.status(500);
                res.json({error: saveErr.message});
                return;
            }
            res.json({message: "Successfully updated", item: saveRes});
        });
    });
});

//Update permission NOTE THIS DOES NOT VALIDATE given topic or comment ids.
//NOTE that the allow flag does matter, but it is implied to be allow true for topics and allow false for comments
router.post("/", function(req, res, next){
    var db = require('../db/db');

    var permission = new db.Permission;

    var log = require('npmlog');

    var config = require('config');
    var adminGroup = config.get('adminGroup')

    if (req.user.groups.indexOf(adminGroup) === -1){
        res.status(403);
        return res.json({error: "Forbidden"});
    }

    permission.priority = req.body.priority;
    if (typeof(req.body.allow) !== "undefined") {
        permission.allow = req.body.allow;
    }

    permission.topic_id = (typeof(req.body.topic_id) !== "undefined") ? req.body.topic_id : null ;
    permission.comment_id = (typeof(req.body.comment_id) !== "undefined") ? req.body.comment_id : null ;
    permission.user_ids = (typeof(req.body.user_ids) !== "undefined") ? req.body.user_ids : null ;
    permission.group_ids = (typeof(req.body.group_ids) !== "undefined") ? req.body.group_ids : null ;

    log.debug("Creating permission: ", permission);

    permission.save(function(saveErr, saveRes){
        if (saveErr){
            res.status(500);
            res.json({error: saveErr.message});
            return;
        }
        res.json({message: "Successfully written", item: saveRes});
    });
});

router.delete("/:id", function(req, res, next){
    var db = require('../db/db');

    var permission = new db.Permission;
    var mongoose = require('mongoose');

    var log = require('npmlog');

    var id = mongoose.Types.ObjectId(req.params.id);

    var config = require('config');
    var adminGroup = config.get('adminGroup')

    if (req.user.groups.indexOf(adminGroup) === -1){
        res.status(403);
        return res.json({error: "Forbidden"});
    }

    log.debug("Deleting permission: ", permission);

    db.Permission.deleteOne({_id: id}, function(deleteErr, deleteRes){
        if (deleteErr){
            res.status(500);
            res.json({error: deleteErr.message});
            return;
        }
        res.json({message: "Successfully deleted", item: deleteRes});
    });
});

module.exports = router;