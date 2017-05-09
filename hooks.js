/* Copyright 2014 Alexander Oberegger, Igor Skoric

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License. */


/*
 REQUIRES
 */
var path = require('path');
var eejs = require('ep_etherpad-lite/node/eejs');
var padManager = require('ep_etherpad-lite/node/db/PadManager');
var db = require('ep_etherpad-lite/node/db/DB').db;
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var groupManager = require('ep_etherpad-lite/node/db/GroupManager');
var Changeset = require('ep_etherpad-lite/static/js/Changeset');
var mysql = require('mysql');
var email = require('emailjs');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var authorManager = require('ep_etherpad-lite/node/db/AuthorManager');
var sessionManager = require('ep_etherpad-lite/node/db/SessionManager');
var crypto = require('crypto');
var pkg = require('./package.json');
var settingsJson = require(__dirname + '/settings.json');
var eMailAuth = settingsJson.email;
var confParams = settingsJson.params;
var confNotify = settingsJson.notification;
var confPiwik = settingsJson.piwik;
var express = require('express');
var formidable = require("formidable");
var _ = require('highland');


/* 
 email settings 
 */
var nodemailer = require('nodemailer');
var node_mailer_transport = nodemailer.createTransport("sendmail");


/*
 CONSTANTS
 */
var DEBUG_ENABLED = confParams.debugEnabled;
var USER_EXISTS = 'User already Exists';
var PASSWORD_WRONG = 'Passwords do not match';
var NO_VALID_MAIL = 'No valid E-Mail';
var PW_EMPTY = 'Password is empty';

var menuItems = [
    { id: 'home', title: 'Home', location: 'home.html' },
    { id: 'pads', title: 'Public Pads', location: 'pads.html' },
    { id: 'groups', title: 'My Groups', location: 'groups.html' },
    { id: 'help', title: 'Help', location: 'help.html' }
];

/*
 CONFIG
 */
var dbAuth = settings.dbSettings;
var dbAuthParams = {
    host: dbAuth.host,
    user: dbAuth.user,
    password: dbAuth.password,
    database: dbAuth.database,
    insecureAuth: true,
    stringifyObjects: true,
    connectionLimit: confParams.connectionLimit
};
var pool = mysql.createPool(dbAuthParams);

settings.encryptPassword = function (password, salt, cb) {
    var encrypted = crypto.createHmac('sha256', salt).update(password).digest('hex');
    cb(encrypted);
};

/*
 *  Common Utility Functions
 */
var log = function (type, message) {
    if (typeof message == 'string') {
        if (type == 'error') {
            console.error(pkg.name, message);
        } else if (type == 'debug') {
            if (DEBUG_ENABLED) {
                console.log('(debug)', pkg.name, message);
            }
        } else {
            console.log(pkg.name + message);
        }
    }
    else console.log(message);
};

var mySqlErrorHandler = function (err) {
    log('debug', 'mySqlErrorHandler');
    var msg = 'MySQLError: ';
    if (err['fatal']) {
        msg += '(FATAL) ';
    }
    msg += err.message;
    log('error', msg);
    log('debug', err);
};

var defaulthandler = function (err, rows, cb) {
    if (err) {
        mySqlErrorHandler(err);
        cb([]);
    } else cb(rows);
};

var encryptPassword = function (password, salt, cb) {
    var encrypted = crypto.createHmac('sha256', salt).update(password).digest('hex');
    cb(encrypted);
};

function getRandomNum(lbound, ubound) {
    return (Math.floor(Math.random() * (ubound - lbound)) + lbound);
}

function getRandomChar(number, lower, upper, other, extra) {
    var numberChars = '0123456789';
    var lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    var upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var otherChars = '`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/? ';
    var charSet = extra;
    if (number == true)
        charSet += numberChars;
    if (lower == true)
        charSet += lowerChars;
    if (upper == true)
        charSet += upperChars;
    if (other == true)
        charSet += otherChars;
    return charSet.charAt(getRandomNum(0, charSet.length));
}

function createSalt(cb) {
    var mylength = 10;
    var myextraChars = '';
    var myfirstNumber = true;
    var myfirstLower = true;
    var myfirstUpper = true;
    var myfirstOther = false;
    var mylatterNumber = true;
    var mylatterLower = true;
    var mylatterUpper = true;
    var mylatterOther = false;

    var rc = "";
    if (mylength > 0) {
        rc += getRandomChar(myfirstNumber, myfirstLower, myfirstUpper, myfirstOther, myextraChars);
    }
    for (var idx = 1; idx < mylength; ++idx) {
        rc += getRandomChar(mylatterNumber, mylatterLower, mylatterUpper, mylatterOther, myextraChars);
    }
    cb(rc);

}

function getPassword(cb) {
    var mylength = 40;
    var myextraChars = '';
    var myfirstNumber = true;
    var myfirstLower = true;
    var myfirstUpper = true;
    var myfirstOther = false;
    var mylatterNumber = true;
    var mylatterLower = true;
    var mylatterUpper = true;
    var mylatterOther = false;

    var rc = "";
    if (mylength > 0) {
        rc += getRandomChar(myfirstNumber, myfirstLower, myfirstUpper, myfirstOther, myextraChars);
    }
    for (var idx = 1; idx < mylength; ++idx) {
        rc += getRandomChar(mylatterNumber, mylatterLower, mylatterUpper, mylatterOther, myextraChars);
    }
    cb(rc);
}

var userAuthenticated = function (req) {
    log('debug', 'userAuthenticated function');
    return req.session.username && req.session.password && req.session.userId && req.session.email;
};

var userAuthentication = function (username, password, cb) {
    log('debug', 'userAuthentication');
    var userSql = "Select * from User AS u where u.name = ?";

    pool.query(userSql, [username], function (err, res) {
        if (err) {
            mySqlErrorHandler(err);
            return;
        }

        var foundUser = res[0];
        if (typeof foundUser != 'object' || !('salt' in foundUser)) {
            log('error', 'problem with user. not found?');
            log('debug', foundUser);
            cb(false, null, false, null, null);
            return;
        }

        encryptPassword(password, foundUser['salt'], function (encrypted) {
            // note: allows login with password or with full pwd hash, to allow direct login after confirmation
            if ((foundUser['pwd'] == encrypted || foundUser['pwd'] == password)
                && foundUser['considered'] && foundUser['active']) {
                // password correct
                cb(true, foundUser, true, foundUser['considered'], foundUser['active']);
            } else {
                // password incorrect
                cb(false, foundUser, true, foundUser['considered'], foundUser['active']);
            }
        });
    });
};

function existValueInDatabase(sql, params, cb) {
    log('debug', 'existValueInDatabase');
    pool.query(sql, params, function (err, found) {
        if (err) {
            log('error', 'existValueInDatabase error, sql: ' + sql);
            cb(false);
        } else if (!found || found.length == 0) {
            log('debug', 'existValueInDatabase false');
            cb(false);
        } else {
            log('debug', 'existValueInDatabase true');
            cb(true);
        }
    });
}

function getOneValueSql(sql, params, cb) {
    log('debug', 'getOneValueSql');
    pool.query(sql, params, function (err, found) {
        if (err) {
            mySqlErrorHandler(err);
            log('error', 'getOneValueSql error, sql: ' + sql);
            cb(false, null);
        } else if (!found || found.length == 0) {
            cb(false, null);
        } else {
            cb(true, found);
        }
    });
}

function updateSql(sqlUpdate, params, cb) {
    log('debug', 'updateSql');
    pool.query(sqlUpdate, params, function (err) {
        if (err) {
            mySqlErrorHandler(err);
            cb(false)
        } else {
            cb(true);
        }
    });
}

function getAllSql(sql, params, cb) {
    log('debug', 'getAllSql');
    pool.query(sql, params, function (err, res) {
        defaulthandler(err, res, cb);
    });
}

function getUser(userId, cb) {
    log('debug', 'getUser');
    var sql = "Select * from User as u where u.id = ?";
    getOneValueSql(sql, [userId], cb);
}

function getGroup(groupId, cb) {
    log('debug', 'getGroup');
    var sql = "Select * from Groups as g where g.id = ?";
    getOneValueSql(sql, [groupId], cb);
}

function getUserGroup(groupId, userId, cb) {
    log('debug', 'getUserGroup');
    var sql = "Select * from UserGroup AS ug where ug.group_id = ? and ug.user_id = ?";
    getOneValueSql(sql, [groupId, userId], cb);
}

function getEtherpadGroupFromNormalGroup(id, cb) {
    log('debug', 'getEtherpadGroupFromNormalGroup');
    var getMapperSql = "Select * from store as s where s.key = ?";
    pool.query(getMapperSql, ["mapper2group:" + id], function (err, res) {
        if (err) {
            mySqlErrorHandler(err);
            cb(false, null);
            return;
        } else if (typeof res[0] != 'object' || typeof res[0].value != 'string' || res[0].value == '') {
            log('error', 'could not getEtherpadGroupFromNormalGroup - id: ' + id);
            log('error', res);
            cb(false, null);
            return;
        }
        cb(true, res[0].value.replace(/"/g, ''));
    });
}

function getPadsOfGroup(id, padname, cb) {
    log('debug', 'getPadsOfGroup');
    var allSql = "Select * from GroupPads as gp where gp.group_id = ? and gp.pad_name like ?";
    pool.query(allSql, [id, "%" + padname + "%"], function (err, results) {
        if (err) {
            mySqlErrorHandler(err);
            return;
        }

        // iterator for found pads
        var iteratorFkt = function (result, iteratorCallback) {
            log('debug', 'iteratorFkt result');
            if (result['pad_name'] == "") {
                return;
            }

            var pad = {
                name: result['pad_name']
            };

            getEtherpadGroupFromNormalGroup(id, function (success, group) {
                log('debug', 'getEtherpadGroupFromNormalGroup callback');
                if (!success) {
                    return;
                }
                log('debug', 'getEtherpadGroupFromNormalGroup cb');
                padManager.getPad(group + "$" + pad.name, null, function (err, origPad) {
                    log('debug', 'padManager.getPad callback');
                    if (err) {
                        log('error', err);
                        return;
                    }
                    pad.isProtected = origPad.isPasswordProtected();
                    origPad.getLastEdit(function (err, lastEdit) {
                        pad.lastedit = converterPad(lastEdit);
                        iteratorCallback(null, pad);
                    });
                });
            });
        };

        // begin async execution with highlandjs streams, 5 parallel max
        var streamIterator = _.wrapCallback(iteratorFkt);
        var mystream = _(results).map(streamIterator).parallel(5).errors(function (err, push) {
            log('error', err);
        });
        mystream.toArray(cb);
    });
}

var converter = function (UNIX_timestamp) {
    var a = new Date(UNIX_timestamp);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = (( a.getHours() < 10) ? "0" : "") + a.getHours();
    var min = ((a.getMinutes() < 10) ? "0" : "") + a.getMinutes();
    var sec = ((a.getSeconds() < 10) ? "0" : "") + a.getSeconds();
    return date + '. ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
};

var converterPad = function (UNIX_timestamp) {
    var a = new Date(UNIX_timestamp);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = (( a.getHours() < 10) ? "0" : "") + a.getHours();
    var min = ((a.getMinutes() < 10) ? "0" : "") + a.getMinutes();
    return date + '. ' + month + ' ' + year + ' ' + hour + ':' + min + ' Uhr';
};


function addUserToEtherpad(userName, cb) {
    log('debug', 'addUserToEtherpad');
    authorManager.createAuthorIfNotExistsFor(userName, null, function (err, author) {
        if (err) {
            log('error', 'something went wrong while creating author');
            cb();
        } else {
            cb(author);
        }
    });
}

function addPadToEtherpad(padName, groupId, cb) {
    log('debug', 'addPadToEtherpad');
    getEtherpadGroupFromNormalGroup(groupId, function (success, group) {
        if (!success) {
            return;
        }
        groupManager.createGroupPad(group, padName, function (err) {
            log('debug', [group, padName]);
            if (err) {
                log('error', 'something went wrong while adding a group pad');
                cb()
            } else {
                cb();
            }
        });
    });
}

function deleteGroupFromEtherpad(id, cb) {
    getEtherpadGroupFromNormalGroup(id, function (success, group) {
        if (!success) {
            return;
        }
        groupManager.deleteGroup(group, function (err) {
            if (err) {
                log('error', 'Something went wrong while deleting group from etherpad');
                cb(false);
                return;
            }

            var sql = "DELETE FROM store where store.key = ?";
            pool.query(sql, ["mapper2group:" + id], function (err, res) {
                defaulthandler(err, res, function () {
                    cb(true);
                })
            });
        });
    });
}


var deletePadFromEtherpad = function (name, groupid, cb) {
    getEtherpadGroupFromNormalGroup(groupid, function (success, group) {
        if (!success) {
            return;
        }
        padManager.removePad(group + "$" + name);
        cb();
    });
};

function sendError(error, res) {
    var data = {
        success: false,
        error: error
    };
    log('error', error);
    res.send(data);
}

var sendEmail = function (message) {
    /*if (DEBUG_ENABLED) {
        log('debug', 'DEBUG MODE, SKIPPING E-MAIL SENDING');
        return;
    }*/

    if (!message.from || !message.to || !message.subject || !message.text) {
        log('error', 'EMAIL: malformed message parameter')
    }

    var eMailSuccess = true;
    var error = {};

    if (eMailAuth['smtp'] == "false") {
        node_mailer_transport.sendMail(message);
    } else {
        emailserver.send(message, function (err) {
            if (err) {
                error = err;
                eMailSuccess = false;
            }
        });
    }

    if (!eMailSuccess) {
        log('error', 'email send error');
        log('error', error);
    }
};

function notRegisteredUpdate(userid, groupid, email) {
    var userGroupSql = "INSERT INTO UserGroup VALUES(?, ?, 2)";
    updateSql(userGroupSql, [userid, groupid], function (success) {
        if (success) {
            var deleteNotRegisteredSql = "DELETE FROM NotRegisteredUsersGroups where group_id = ? and email = ?";
            updateSql(deleteNotRegisteredSql, [groupid, email], function (success) {
            });
        }
    });
}

function checkInvitations(email, userid, cb) {
    var userNotRegisteredSql = "select * from NotRegisteredUsersGroups as nr where nr.email = ?";
    pool.query(userNotRegisteredSql, [email], function (err, res) {
        if (res.length == 0) {
            cb();
            return;
        }
        for (var i = 0; i < res.length; i++) {
            notRegisteredUpdate(userid, res[i].group_id, email);
        }
        cb();
    });
}

var registerUser = function (user, cb) {
    if (user.password != user.passwordrepeat) {
        cb(false, PASSWORD_WRONG);
        return; // break execution early
    }
    if (user.password == "") {
        cb(false, PW_EMPTY);
        return; // break execution early
    }

    var validEmail = user.email.toString().match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,4}/);
    if (validEmail == null) {
        cb(false, NO_VALID_MAIL);
        return; // break execution early
    }

    var existUser = "SELECT * from User as u where u.name = ?";

    existValueInDatabase(existUser, [user.email], function (exists) {
        if (exists) {
            cb(false, USER_EXISTS);
            return;
        }
        getPassword(function (consString) {
            var msg = eMailAuth['registrationtext'].replace(/<url>/, user.location + "confirm/" + consString);
            var message = {
                text: msg,
                from: eMailAuth['registrationfrom'],
                to: user.email + " <" + user.email + ">",
                subject: eMailAuth['registrationsubject']
            };

            sendEmail(message);

            createSalt(function (salt) {
                encryptPassword(user.password, salt, function (encrypted) {
                    var addUserSql = "INSERT INTO User VALUES(null, ?, ?, 0, 0, ?, ?, ?, 1)";
                    pool.query(addUserSql, [user.email, encrypted, user.fullname, consString, salt], function (err, newUser) {
                        if (err) {
                            mySqlErrorHandler(err);
                            cb(false, err);
                            return;
                        }
                        checkInvitations(user.email, newUser.insertId, function () {
                            addUserToEtherpad(newUser.insertId, function () {
                                cb(true, null);
                            });
                        });
                    });
                });
            });
        });
    })
};

function mapAuthorWithDBKey(mapperkey, mapper, callback) {
    //try to map to an author
    db.get(mapperkey + ":" + mapper, function (err, author) {
        if (ERR(err, callback)) return;

        //there is no author with this mapper, so create one
        if (author == null) {
            authorManager.createAuthor(null, function (err, author) {
                //create the token2author relation
                db.set(mapperkey + ":" + mapper, author.authorID);

                //return the author
                callback(null, author);
            });
            return;
        }
        //there is a author with this mapper
        //update the timestamp of this author
        db.setSub("globalAuthor:" + author, ["timestamp"], new Date().getTime());

        //return the author
        callback(null, {authorID: author});
    });
}

function deleteUserFromEtherPad(userid, cb) {
    mapAuthorWithDBKey("mapper2author", userid, function (err, author) {
        db.remove("globalAuthor:" + author.authorID);
        var mapper2authorSql = "SELECT * FROM store AS s WHERE s.key = ? or (s.value = ? and s.key like 'token2author:%')";
        pool.query(mapper2authorSql, ["mapper2author:" + userid, '"' + author.authorID + '"'], function (err) {
            if (err) {
                mySqlErrorHandler(err);
            }
            cb();
        });
    });
}

var emailserver = email.server.connect({
    user: eMailAuth.user,
    password: eMailAuth.password,
    host: eMailAuth.host,
    port: eMailAuth.port,
    ssl: eMailAuth.ssl
});

/*
 * GENERATORS 
 */
var getHeader = function (username, active) {
    var args = {
        menuitems: menuItems,
        username: username,
        active: active,
        theme: confParams.theme
    };
    return eejs.require("ep_user_pads/templates/header_logged_in.ejs", args);
};

var getHeaderNotLogged = function () {
    var args = {theme: confParams.theme};
    return eejs.require("ep_user_pads/templates/header.ejs", args);
};

var getFooter = function () {
    var args = {theme: confParams.theme, notification: JSON.stringify(confNotify)};
    return eejs.require("ep_user_pads/templates/footer.ejs", args);
};

exports.eejsBlock_adminMenu = function (hook_name, args, cb) {
    var hasAdminUrlPrefix = (args.content.indexOf('<a href="admin/') != -1),
        hasOneDirDown = (args.content.indexOf('<a href="../') != -1),
        hasTwoDirDown = (args.content.indexOf('<a href="../../') != -1);

    var urlPrefix = hasAdminUrlPrefix ? "admin/" : hasTwoDirDown ? "../../" : hasOneDirDown ? "../" : "";
    args.content = args.content + '<li><a href="' + urlPrefix + 'userpadadmin">User Administration</a> </li>';
    cb();
};

exports.eejsBlock_useradminmenu = function (hook_name, args, cb) {
    cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
    args.content = args.content + eejs.require("ep_user_pads/templates/styles.ejs", {}, module);
    cb();
};

exports.socketio = function (hook_name, args, cb) {
    var io = args.io.of("/pluginfw/admin/user_pad");
    io.on('connection', function (socket) {

        if (!socket.handshake.session.user || !socket.handshake.session.user['is_admin']) return;

        // search group
        socket.on("search-group", function (searchTerm, cb) {
            log('debug', 'search-group' + searchTerm);
            var allSql = "SELECT Groups.id AS id, Groups.name AS name, count(UserGroup.user_id) AS amAuthors " +
                "FROM Groups LEFT JOIN UserGroup on Groups.id = UserGroup.group_id " +
                "WHERE Groups.name like ? " +
                "GROUP BY Groups.id";
            pool.query(allSql, ["%" + searchTerm + "%"], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // normal-group-to-etherpad-group
        socket.on("normal-group-to-etherpad-group", function (groupid, cb) {
            log('debug', 'normal-group-to-etherpad-group id=' + groupid);
            var getMapperSql = "Select * from store as s where s.key = ?";
            pool.query(getMapperSql, ["mapper2group:" + groupid], function (err, res) {
               if (err) {
                  mySqlErrorHandler(err);
                  cb(false, groupid, null);
                  return;
               } else if (typeof res[0] != 'object' || typeof res[0].value != 'string' || res[0].value == '') {
                  log('error', 'could not getEtherpadGroupFromNormalGroup - id: ' + groupid);
                  log('error', res);
                  cb(false, groupid, null);
                  return;
               }
               cb(true, groupid, res[0].value.replace(/"/g, ''));
            });
        });

        // search pads
        socket.on("search-pads", function (searchTerm, cb) {
            var allSql = "Select pad_name as name from GroupPads where GroupPads.group_id = ? and GroupPads.pad_name like ?";
            pool.query(allSql, [searchTerm.id, "%" + searchTerm.term + "%"], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // search-all-users-not-in-group
        socket.on("search-all-users-not-in-group", function (vals, cb) {
            var allSql = "SELECT u.name as name, u.id as userID " +
                "FROM User as u " +
                "WHERE NOT EXISTS " +
                "(Select 1 from UserGroup as ug where ug.user_id = u.id and ug.group_id = ?)";
            pool.query(allSql, [vals.groupid], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // search-group-user
        socket.on("search-group-user", function (searchTerm, cb) {
            var allSql = "SELECT User.id as id, User.name as name, User.active as active " +
                "FROM UserGroup " +
                "JOIN User on UserGroup.user_id = User.id " +
                "WHERE UserGroup.group_id = ?";
            pool.query(allSql, [searchTerm.id], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // delete-group
        socket.on("delete-group", function (id, cb) {
            var deleteGroupSql = "DELETE FROM Groups WHERE Groups.id = ?";
            pool.query(deleteGroupSql, [id], function (err) {
                if (err) {
                    mySqlErrorHandler(err);
                    return;
                }
                deleteGroupFromEtherpad(id, function (resu) {
                    if (!resu) {
                        log('error', 'Deleted group with id ' + id + 'from Database but could not delete from EP.');
                    }
                    cb();
                });
            });
        });

        // delete-pad
        socket.on("delete-pad", function (name, groupid, cb) {
            var deletePadSql = "DELETE FROM GroupPads WHERE GroupPads.group_id = ? and GroupPads.pad_name = ?";
            pool.query(deletePadSql, [groupid, name], function (err) {
                if (err) {
                    mySqlErrorHandler(err);
                    cb(null);
                    return;
                }
                deletePadFromEtherpad(name, groupid, function () {
                    cb()
                });
            })
        });

        // suspend-user-from-group
        socket.on("suspend-user-from-group", function (usergroup, cb) {
            var deleteUserSql = "DELETE FROM UserGroup where UserGroup.user_id = ? and UserGroup.group_id = ?";
            pool.query(deleteUserSql, [usergroup.userid, usergroup.groupid], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // add group
        socket.on("add-group", function (name, cb) {
            var existGroupSql = "SELECT * from Groups WHERE Groups.name = ?";
            // todo: replace with simple insert error handling
            existValueInDatabase(existGroupSql, [name], function (valueExists) {
                if (valueExists) {
                    log('error', 'tried to add group that already exists');
                    cb(false);
                    return;
                }
                var addGroupSql = "INSERT INTO Groups VALUES(null, ?)";
                pool.query(addGroupSql, [name], function (err, group) {
                    groupManager.createGroupIfNotExistsFor(group.insertId.toString(), function (err) {
                        if (err) {
                            log('error', err);
                            cb(false);
                        } else cb(true);
                    });
                });
            });
        });


        // add-pad-to-group
        // todo: remove existValueInDatabase and replace with insert error handling
        socket.on("add-pad-to-group", function (padGroup, cb) {
            log('debug', ["adding pad to group", padGroup]);

            if (padGroup.groupid == "" || padGroup.padName == "") {
                log('error', ["add-pad-to-group", "failed to add pad", padGroup]);
                cb(false);
                return;
            }

            var existPadInGroupSql = "SELECT * from GroupPads as gp where gp.group_id = ? and gp.pad_name = ?";
            existValueInDatabase(existPadInGroupSql, [padGroup.groupid, padGroup.padName], function (exists) {
                if (exists) {
                    log('error', ["add-pad-to-group", "already exists", padGroup]);
                    cb(false);
                    return;
                }
                var addPadToGroupSql = "INSERT INTO GroupPads VALUES(?, ?)";
                pool.query(addPadToGroupSql, [padGroup.groupid, padGroup.padName], function (err) {
                    if (err) {
                        mySqlErrorHandler(err);
                        cb(false);
                        return;
                    }
                    addPadToEtherpad(padGroup.padName, padGroup.groupid, function () {
                        cb(true);
                    });
                });
            })
        });

        // add-user-to-group
        // todo: remove existValueInDatabase and replace with insert error handling
        socket.on("add-user-to-group", function (userGroup, cb) {
            var existPadInGroupSql = "SELECT * from UserGroup where UserGroup.group_id = ? and UserGroup.user_id = ?";
            existValueInDatabase(existPadInGroupSql, [userGroup.groupid, userGroup.userID], function (bool) {
                if (bool) {
                    cb(false);
                    return;
                }
                var addPadToGroupSql = "INSERT INTO UserGroup VALUES(?, ?, 2)";
                pool.query(addPadToGroupSql, [userGroup.userID, userGroup.groupid], function (err, res) {
                    defaulthandler(err, res, cb)
                });
            })
        });

        // search-all-user
        socket.on("search-all-user", function (searchTerm, cb) {
            var allSql = "SELECT u.id AS id, u.name, u.active, count(ug.user_id) as amGroups FROM User AS u " +
                "LEFT JOIN UserGroup as ug on u.id = ug.user_id " +
                "GROUP BY u.id";
            pool.query(allSql, ["%" + searchTerm + "%"], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // add-user
        // todo: remove existValueInDatabase and replace with insert error handling
        socket.on("add-user", function (user, cb) {
            var existUser = "SELECT * from User where User.name = ?";
            existValueInDatabase(existUser, [user.name], function (exists) {
                if (exists) {
                    cb(false, 'User already exists!');
                    return;
                }
                createSalt(function (salt) {
                    encryptPassword(user.pw, salt, function (encrypted) {
                        var addUserSql = "INSERT INTO User VALUES(null, ?,?,1,0,'Change This Name','klfdsa',?,1)";
                        pool.query(addUserSql, [user.name, encrypted, salt], function (err, newUser) {
                            if (err) {
                                mySqlErrorHandler(err);
                                cb(false);
                                return;
                            }
                            addUserToEtherpad(newUser.insertId, function () {
                                cb(true, 'User added!');
                            });
                        })
                    });
                })
            });
        });

        // deactivate-user
        socket.on("deactivate-user", function (user, cb) {
            var sqlUpdate = "UPDATE User SET User.active = 0 where id = ?";
            pool.query(sqlUpdate, [user.id], function (err, res) {
                    defaulthandler(err, res, cb)
                }
            );
        });

        // activate-user
        socket.on("activate-user", function (user, cb) {
            var sqlUpdate = "UPDATE User SET User.active = 1 where id = ?";
            pool.query(sqlUpdate, [user.id], function (err, res) {
                    defaulthandler(err, res, cb)
                }
            );
        });

        // reset-pw-user
        socket.on("reset-pw-user", function (vals, cb) {
            getPassword(function (pw) {
                var userSql = "SELECT * from User where User.id = ?";
                pool.query(userSql, [vals.id], function (err, users) {
                    if (err) {
                        mySqlErrorHandler(err);
                        cb(false);
                        return
                    }
                    var user = users[0];
                    var msg = eMailAuth['resetpwmsg'];
                    msg = msg.replace(/<password>/, pw);
                    var message = {
                        text: msg,
                        from: "NO-REPLY <" + eMailAuth['resetfrom'] + ">",
                        to: user.FullName + " <" + user.name + ">",
                        subject: eMailAuth['resetsubject']
                    };
                    var nodemailer = require('nodemailer');
                    var transport = nodemailer.createTransport("sendmail");
                    createSalt(function (salt) {
                        encryptPassword(pw, salt, function (encrypted) {
                            if (eMailAuth.smtp == 'false') {
                                transport.sendMail(message);
                                var retval = {};
                                retval.id = vals.id;
                                retval.row = vals.row;
                                var sqlUpdate = "UPDATE User SET pwd = ?, salt = ? where id = ?";
                                pool.query(sqlUpdate, [encrypted, salt, retval.id], function (err) {
                                    if (err) {
                                        mySqlErrorHandler(err);
                                    }
                                    retval.success = !err;
                                    cb(retval);
                                });
                                return;
                            }
                            emailserver.send(message, function (err) {
                                var retval = {};
                                retval.id = vals.id;
                                retval.row = vals.row;
                                if (err) {
                                    retval.success = false;
                                    cb(retval);
                                    return;
                                }
                                var sqlUpdate = "UPDATE User SET pwd = ?, salt = ? where id = ?";
                                pool.query(sqlUpdate, [encrypted, salt, retval.id], function (err) {
                                    if (err) {
                                        mySqlErrorHandler(err);
                                    }
                                    retval.success = !err;
                                    cb(retval);
                                });
                            });
                        });
                    });
                });
            });
        });

        // delete-user
        // todo: remove existValueInDatabase
        socket.on("delete-user", function (userid, hard, cb) {
            var isOwner = "SELECT * from UserGroup where UserGroup.user_id = ? and UserGroup.role_id = 1";
            existValueInDatabase(isOwner, [userid], function (exist) {
                if (exist && !hard) {
                    cb(false);
                } else if (!exist || (exist && hard)) {
                    // todo: replace with database constraints
                    var userSQL = "DELETE FROM User where User.id = ?";
                    pool.query(userSQL, [userid], function (err) {
                        if (err) {
                            mySqlErrorHandler(err);
                            cb(false);
                            return;
                        }
                        var userGroupSQL = "DELETE FROM UserGroup where UserGroup.user_id = ?";
                        pool.query(userGroupSQL, [userid], function (err) {
                            if (err) {
                                mySqlErrorHandler(err);
                                cb(false);
                                return;
                            }
                            deleteUserFromEtherPad(userid, function () {
                                cb(true);
                            });
                        });
                    });
                }
            });
        });

        // search-pads-of-user
        socket.on("search-pads-of-user", function (searchTerm, cb) {
            var allSql = "Select pad_name from UserGroup " +
                "JOIN GroupPads on UserGroup.group_id = GroupPads.group_id " +
                "WHERE UserGroup.user_id = ?";
            pool.query(allSql, [searchTerm.id], function (err, foundPads) {
                defaulthandler(err, foundPads, cb);
            });
        });

        // search-groups-of-user
        socket.on("search-groups-of-user", function (searchTerm, cb) {
            var allSql = "SELECT g.id AS id, g.name AS name " +
                "FROM Groups AS g " +
                "JOIN UserGroup AS ug on g.id = ug.group_id " +
                "WHERE ug.user_id = ?";
            pool.query(allSql, [searchTerm.id], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // add-group-to-user
        // todo: remove existValueInDatabase
        socket.on("add-group-to-user", function (userGroup, cb) {
            var existGroupInUserSql = "SELECT * from UserGroup where UserGroup.group_id = ? and UserGroup.user_id = ?";
            existValueInDatabase(existGroupInUserSql, [userGroup.groupid, userGroup.userID], function (bool) {
                if (bool) {
                    cb(false);
                    return;
                }
                var addGroupToUserSql = "INSERT INTO UserGroup VALUES(?,?,2)";
                pool.query(addGroupToUserSql, [userGroup.userID, userGroup.groupid], function (err, res) {
                    defaulthandler(err, res, cb);
                });
            });
        });

        // search-groups-not-in-user
        // means: search for groups that the user is not in
        socket.on("search-groups-not-in-user", function (vals, cb) {
            var allSql = "SELECT g.name,g.id AS id " +
                "FROM Groups AS g " +
                "WHERE NOT EXISTS " +
                "(SELECT 1 FROM UserGroup AS ug WHERE ug.group_id = g.id AND ug.user_id = 3)";
            pool.query(allSql, [vals.id, "%" + vals.name + "%"], function (err, res) {
                defaulthandler(err, res, cb)
            });
        });

        // direct-to-group-pad
        socket.on("direct-to-group-pad", function (author, groupid, pad_name, cb) {
            getEtherpadGroupFromNormalGroup(groupid, function (success, group) {
                addUserToEtherpad(author, function (etherpad_author) {
                    sessionManager.createSession(group, etherpad_author.authorID, Date.now() + 7200000,
                        function (err, session) {
                            if (err) {
                               log('error', 'could not create session');
                               log('error', err);
                               return; // break execution
                            }
                            cb(session.sessionID, group, pad_name);
                        });
                });
            });
        });
    });
    cb();
};


/* Copyright 2014 Alexander Oberegger, Igor Skoric

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License. */
// todo: merge


var loginUser = function (req, user) {
    req.session.email = user.name;
    req.session.password = user.pwd;
    req.session.userId = user.id;
    req.session.username = user.FullName;
    return req;
};
function logoutUser(req) {
    req.session.email = null;
    req.session.password = null;
    req.session.userId = null;
    req.session.username = null;
    return req;
}
exports.expressCreateServer = function (hook_name, args, cb) {
    /*
     ADMIN PART
     */
    args.app.get('/admin/userpadadmin', function (req, res) {
        var sql = "(select 'users', count(*) as count from User)"
            + "union (select 'groups', count(*) from Groups)"
            + "union (select 'grouppads', count(*) from GroupPads)"
            + "union (select 'invites', count(*) from NotRegisteredUsersGroups);";
        var render_args = { users: 0, groups: 0, grouppads: 0, invites: 0, errors: []};

        pool.query(sql, function (err, reslt) {
            if (err) {
                mySqlErrorHandler(err);
            } else {
                render_args.users = reslt[0]['count'];
                render_args.groups = reslt[1]['count'];
                render_args.grouppads = reslt[2]['count'];
                render_args.invites = reslt[3]['count'];
            }
            log('debug', render_args);
            res.send(eejs.require("ep_user_pads/templates/admin/user_pad_admin.ejs", render_args));
        });
    });
    args.app.get('/admin/userpadadmin/groups', function (req, res) {
        res.send(eejs.require("ep_user_pads/templates/admin/user_pad_admin_groups.ejs", {errors: []}));
    });
    args.app.get('/admin/userpadadmin/groups/group', function (req, res) {
        res.send(eejs.require("ep_user_pads/templates/admin/user_pad_admin_group.ejs", {errors: []}));
    });
    args.app.get('/admin/userpadadmin/users', function (req, res) {
        res.send(eejs.require("ep_user_pads/templates/admin/user_pad_admin_users.ejs", {errors: []}));
    });
    args.app.get('/admin/userpadadmin/users/user', function (req, res) {
        res.send(eejs.require("ep_user_pads/templates/admin/user_pad_admin_user.ejs", {errors: []}));
    });

    /*
     FRONTEND PART
     */
    args.app.get('/index.html', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (authenticated) {
            res.redirect('home.html');
            return;
        }

        var render_args = {
            errors: [],
            username: req.session.username,
            footer: getFooter(),
            organization: confParams.organization
        };

        res.send(eejs.require("ep_user_pads/templates/index.ejs", render_args));
    });

    args.app.get('/help.html', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (!authenticated) {
            res.redirect("../index.html");
            return;
        }
        getUser(req.session.userId, function (found, currUser) {
            var render_args = {
                errors: [],
                username: "",
                footer: getFooter()
            };
            if (currUser && currUser.length > 0) {
                render_args.username = currUser[0].FullName;
            }
            render_args.header = getHeader(render_args.username, 'help');
            res.send(eejs.require("ep_user_pads/templates/help.ejs", render_args));
        })
    });

    args.app.get('/home.html', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (!authenticated) {
            res.redirect("../index.html");
            return;
        }
        var sql = "Select g.* from Groups as g " +
            "inner join UserGroup as ug on (ug.group_id = g.id) where ug.user_id = ?";
        getAllSql(sql, [req.session.userId], function (groups) {
            getUser(req.session.userId, function (found, currUser) {
                var render_args = {
                    errors: [],
                    username: "",
                    footer: getFooter(),
                    groups: groups,
                    piwik: confPiwik
                };
                if (currUser) {
                    render_args.username = currUser[0].FullName;
                }
                render_args.header = getHeader(render_args.username, 'home');
                res.send(eejs.require("ep_user_pads/templates/home.ejs", render_args));
            });
        });
    });


    args.app.get('/pads.html', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (!authenticated) {
            res.redirect("../index.html");
            return;
        }
        getUser(req.session.userId, function (found, currUser) {
            var render_args = {
                errors: [],
                username: "",
                footer: getFooter()
            };
            if (found && currUser) {
                render_args.username = currUser[0].FullName;
            }
            render_args.header = getHeader(render_args.username, 'pads');
            res.send(eejs.require("ep_user_pads/templates/pads.ejs", render_args));
        });
    });

    args.app.get('/group.html/:groupid', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (!authenticated) {
            res.redirect("../../index.html");
            return;
        }
        log('debug', req.path + 'Authenticated');
        getPadsOfGroup(req.params.groupid, '', function (pads) {
            log('debug', req.path + 'getPadsOfGroup CB');
            getUser(req.session.userId, function (found, currUser) {
                log('debug', req.path + 'getUser CB');
                getGroup(req.params.groupid, function (found, currGroup) {
                    log('debug', req.path + 'getGroup CB');
                    getUserGroup(req.params.groupid, req.session.userId, function (found, currUserGroup) {
                        log('debug', req.path + 'getUserGroup CB');
                        if (!currUserGroup) {
                            var render_args = {
                                errors: [],
                                msg: "This group does not exist! Perhaps someone has deleted the group.",
                                footer: getFooter()
                            };
                            res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
                            return;
                        }
                        if (currGroup && currUser && currUserGroup) {
                            render_args = {
                                errors: [],
                                id: currGroup[0].name,
                                groupid: currGroup[0].id,
                                username: currUser[0].FullName,
                                isowner: currUserGroup[0]['role_id'] == 1,
                                pads: pads,
                                footer: getFooter(),
                                header: getHeader(currUser[0].FullName, '')
                            };
                            res.send(eejs.require("ep_user_pads/templates/group.ejs", render_args));
                            return;
                        }
                        render_args = {
                            errors: [],
                            msg: "This group does not exist. It might have been deleted.",
                            footer: getFooter()
                        };
                        res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
                    });
                });
            });
        });
    });

    args.app.get('/groups.html', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (authenticated) {
            var sql = "Select * from Groups as g " +
                "inner join UserGroup as ug on ( ug.group_id = g.id ) " +
                "where ug.user_id = ?";
            getAllSql(sql, [req.session.userId], function (groups) {
                getUser(req.session.userId, function (found, currUser) {
                    var render_args = {
                        errors: [],
                        username: currUser[0].FullName,
                        footer: getFooter(),
                        groups: groups
                    };

                    render_args.header = getHeader(render_args.username, 'groups');
                    res.send(eejs.require("ep_user_pads/templates/groups.ejs", render_args));
                });

            });
        } else {
            res.redirect("../index.html");
        }
    });

    args.app.post('/padSearchTerm', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                var data = {};
                if (!fields.groupId) {
                    var error = 'Group Id undefined';
                    sendError(error, res);
                    return;
                }
                getPadsOfGroup(fields.groupId, fields.searchterm, function (pads) {
                    getUser(req.session.userId, function (found, currUser) {
                        getGroup(fields.groupId, function (found, currGroup) {
                            if (currUser && currGroup) {
                                var noresults = pads.length <= 0;
                                var render_args = {
                                    errors: [],
                                    noresults: noresults,
                                    pads: pads,
                                    id: currGroup[0].name,
                                    groupid: currGroup[0].id,
                                    username: currUser[0].FullName
                                };
                                data.success = true;
                                data.html = eejs.require("ep_user_pads/templates/padtables.ejs", render_args);
                                res.send(data);
                            }
                        });
                    });
                });

            } else {
                res.send("You are not logged in!!");
            }

        });
    });

    args.app.post('/groupsSearchTerm', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                var sql = "Select * from Groups as g " +
                    "inner join UserGroup as ug on (ug.group_id = g.id) " +
                    "where ug.user_id = ? and g.name like ?";
                getAllSql(sql, [req.session.userId, "%" + fields.searchterm + "%"], function (groups) {
                    var render_args = {
                        errors: [],
                        groups: groups
                    };
                    res.send(eejs.require("ep_user_pads/templates/grouptables.ejs", render_args));
                });

            } else {
                res.send("You are not logged in!!");
            }
        });
    });

    function inviteUser(userN, location, group_id, currUserName, group) {
        var getUserSql = "select * from User as u where u.name = ?";

        pool.query(getUserSql, [userN], function (err, users) {
            if (err) {
                mySqlErrorHandler(err);
                return;
            }

            var isRegistered = users.length != 0;
            var eMail = isRegistered ? users[0].name : userN;
            var msgTxt = eMailAuth['invite_unregistered_msg']
                .replace('<groupname>', group.name)
                .replace('<fromuser>', currUserName)
                .replace('<url>', location);

            var message = {
                text: msgTxt,
                from: eMailAuth['invitationfrom'],
                to: eMail + " <" + eMail + ">",
                subject: eMailAuth['invitationsubject']
            };

            sendEmail(message);

            var sqlRg = "REPLACE INTO UserGroup Values(?, ?, 2)";
            var sqlNrg = "REPLACE INTO NotRegisteredUsersGroups Values(?, ?)";
            var sql = isRegistered ? sqlRg : sqlNrg;
            var firstParam = isRegistered ? users[0].id : eMail;

            pool.query(sql, [firstParam, group_id], function (err) {
                if (err) mySqlErrorHandler(err);
            });
        });
    }

    args.app.post('/inviteUsers', function (req, res) {
        log('debug', '/inviteUsers');
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                sendError("You are not logged in!", res);
                return;
            } else if (!fields.groupID) {
                sendError('Group ID not defined', res);
                return;
            } else if (!fields.users[0]) {
                sendError('No User given', res);
                return;
            }

            var isOwnerSql = "SELECT * from UserGroup as ug " +
                "where ug.user_id = ? and ug.group_id = ?";
            getAllSql(isOwnerSql, [req.session.userId, fields.groupID], function (userGroup) {
                if (!(userGroup[0]['role_id'] == 1)) {
                    sendError('User is not Owner can not send Invitations', res);
                    return;
                }

                var getGroupSql = "select * from Groups as g where g.id = ?";
                pool.query(getGroupSql, [fields.groupID], function (err, groups) {
                    if (err) {
                        mySqlErrorHandler(err);
                        sendError('Server Error!', res);
                        return; // break execution
                    }

                    if (groups.length == 0) {
                        log('error', 'tried to register user to non-existing group');
                        sendError('You are not the owner', res);
                        return; // break execution
                    }

                    var group = groups[0];

                    getUser(req.session.userId, function (found, currUser) {
                        log('debug', fields);
                        for (var i = 0; i < fields.users.length; i++) {
                            if (fields.users[i] != "") {
                                var userEmail = fields.users[i].toString().replace(/\s/g, '');
                                inviteUser(userEmail, fields.location, fields.groupID, currUser[0].FullName, group);
                            }
                        }
                        res.send({success: true});
                    });
                });
            });
        });
    });

    args.app.post('/userSearchTerm', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                if (!fields.groupID) {
                    sendError('Group Id undefined', res);
                    return;
                }
                var isOwnerSql = "SELECT * from UserGroup as ug " +
                    "where ug.user_id = ? and ug.group_id = ?";
                getAllSql(isOwnerSql, [req.session.userId, fields.groupID], function () {
                    var usersSql = "select User.name, User.FullName, User.id, UserGroup.role_id from User inner join UserGroup on(UserGroup.user_id = User.id) where User.id not in (?) and User.id in (select UserGroup.user_id from UserGroup where group_id = ?) and UserGroup.group_id = ? and User.name like ?";
                    getAllSql(usersSql, [req.session.userId, fields.groupID, fields.groupID, "%" + fields.searchterm + "%"], function (users) {
                        var userNotRegisteredSql = "Select * from NotRegisteredUsersGroups AS nr " +
                            "where nr.group_id = ?";
                        getAllSql(userNotRegisteredSql, [fields.groupID], function (notRegistereds) {
                            for (var i = 0; i < notRegistereds.length; i++) {
                                var user = {};
                                user.name = notRegistereds[i].email;
                                user.notRegistered = true;
                                users.push(user);
                            }
                            var data = {};
                            data.success = true;
                            data.users = users;
                            res.send(data);
                        });
                    });
                });
            } else {
                res.send("You are not logged in!!");
            }
        });
    });

    args.app.post('/deleteNotRegUser', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                var deleteNotRegisteredSql = "DELETE FROM NotRegisteredUsersGroups where group_id = ? and email = ?";
                updateSql(deleteNotRegisteredSql, [fields.groupID, fields.username], function (success) {
                    var data = {};
                    data.success = success;
                    res.send(data);
                });
            } else {
                res.send("You are not logged in!!");
            }
        });

    });

    args.app.post('/reinviteUser', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                res.send("You are not logged in!!");
                return;
            }
            getGroup(fields.groupID, function (found, currGroup) {
                getUser(req.session.userId, function (found, currUser) {
                    var msg = eMailAuth['invite_unregistered_msg'];
                    msg = msg.replace(/<groupname>/, currGroup[0].name);
                    msg = msg.replace(/<fromuser>/, currUser[0].name);
                    msg = msg.replace(/<url>/, fields.location);
                    var message = {
                        text: msg,
                        from: eMailAuth['invitationfrom'],
                        to: fields.username + " <" + fields.username + ">",
                        subject: eMailAuth['invitationsubject']
                    };
                    sendEmail(message);
                    res.send({success: true});
                });
            });
        });
    });

    args.app.post('/changeUserName', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                if (fields.newUserName == "") {
                    sendError('User Name empty', res);
                    return;
                }
                var updateUserSql = "UPDATE User SET FullName = ? WHERE id = ?";
                var data = {};
                updateSql(updateUserSql, [fields.newUserName, req.session.userId], function (success) {
                    data.success = success;
                    res.send(data);
                });

            } else {
                res.send("You are not logged in!!");
            }
        });
    });

    args.app.post('/changeEmail', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                if (fields.newEmail == "") {
                    sendError('Mail empty', res);
                    return;
                }
                var Ergebnis = fields.newEmail.toString().match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,4}/);
                if (!Ergebnis) {
                    sendError(NO_VALID_MAIL, res);
                    return;
                }
                var updateUserSql = "UPDATE User SET name = ? WHERE id = ?";
                var data = {};
                updateSql(updateUserSql, [fields.newEmail, req.session.userId], function (success) {
                    data.success = success;
                    res.send(data);
                });

            } else {
                res.send("You are not logged in!!");
            }
        });
    });

    args.app.post('/changeUserPw', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                if (fields.newPW == "" || fields.oldPW == "") {
                    sendError('Password empty', res);
                    return;
                }
                getUser(req.session.userId, function (found, currUser) {
                    if (currUser) {
                        encryptPassword(fields.oldPW, currUser[0].salt, function (encrypted) {
                            if (currUser[0]['pwd'] != encrypted) {
                                sendError('Wrong Password', res);
                                return;
                            }
                            createSalt(function (salt) {
                                encryptPassword(fields.newPW, salt, function (newPass) {
                                    var updateUserSql = "UPDATE User SET pwd = ?, salt = ? WHERE id = ?";
                                    var data = {};
                                    updateSql(updateUserSql, [newPass, salt, req.session.userId], function (success) {
                                        data.success = success;
                                        res.send(data);
                                    });
                                });
                            });
                        });
                    }
                });


            } else {
                res.send("You are not logged in!!");
            }
        });
    });

    args.app.post('/makeOwner', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {

            if (err) {
                sendError("Form Error", res);
                return;
            }

            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                log('info', 'Not logged in Error: ' + req.path);
                sendError("You are not logged in!!", res);
                return;
            }

            if (!fields.userID || fields.userID == "" || !fields.groupID || fields.groupID == "") {
                sendError('No User ID or Group ID given', res);
                return;
            }

            var isOwnerSql = "SELECT * from UserGroup as ug where ug.user_id = ? and ug.group_id = ?";
            getAllSql(isOwnerSql, [req.session.userId, fields.groupID], function (userGroup) {
                if (!(userGroup[0]['role_id'] == 1)) {
                    sendError('User is not owner! Can not delete Pad', res);
                    return;
                }
                var updateUserSql = "UPDATE UserGroup as ug SET ug.role_id = 1 WHERE ug.user_id = ? and ug.group_id = ?";
                updateSql(updateUserSql, [fields.userID, fields.groupID], function (success) {
                    if (!success) {
                        log('error', 'SET role_id = 1 failed');
                        sendError("Server Error");
                        return;
                    }
                    var updateOldUserSql = "UPDATE UserGroup as ug SET ug.role_id = 2 WHERE ug.user_id = ? and ug.group_id = ?";
                    updateSql(updateOldUserSql, [req.session.userId, fields.groupID], function (success) {
                        if (!success) {
                            log('error', 'SET role_id = 2 failed after SET role_id = 1 succeded');
                            sendError("Server Error");
                            return;
                        }
                        res.send({success: true});
                    });
                });
            });
        });
    });


    args.app.post('/deleteUserFromGroup', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                res.send("You are not logged in!!");
                return;
            }
            if (!fields.userID || fields.userID == "" || !fields.groupID || fields.groupID == "") {
                sendError('No User ID or Group ID given', res);
            } else {
                var isOwnerSql = "SELECT * from UserGroup AS ug WHERE ug.user_id = ? and ug.group_id = ?";
                getAllSql(isOwnerSql, [req.session.userId, fields.groupID], function (userGroup) {
                    if (!(userGroup[0]['role_id'] == 1)) {
                        sendError('You are not the owner of this group!!', res);
                        return;
                    }
                    var deleteUserFromGroupSql = "Delete from UserGroup where user_id = ? and group_id = ?";
                    var data = {};
                    updateSql(deleteUserFromGroupSql, [fields.userID, fields.groupID], function (success) {
                        data.success = success;
                        res.send(data);
                    });
                });
            }
        });
    });

    args.app.post('/deleteUser', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (!authenticated) {
            res.send("You are not logged in!!");
            return;
        }
        var isOwnerAnywhere = "select * from UserGroup AS ug where ug.user_id = ? and ug.role_id = 1";
        getOneValueSql(isOwnerAnywhere, [req.session.userId], function (success) {
            if (success) {
                sendError('You are owner in one ore more groups. Please select a follower for the ownership', res);
                return;
            }

            // cascades in DB
            var deleteSqlUser = "Delete from User where id = ?";
            updateSql(deleteSqlUser, [req.session.userId], function (success2) {
                if (success2) {
                    req = logoutUser(req);
                }
                res.send({success: success2});
            });
        });
    });


    args.app.post('/directToPad', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (authenticated) {
                if (!fields.groupId) {
                    sendError('Group-Id not defined', res);
                    return;
                }
                var userInGroupSql = "SELECT * from UserGroup AS ug WHERE ug.user_id = ? and ug.group_id = ?";
                getOneValueSql(userInGroupSql, [req.session.userId, fields.groupId], function (found) {
                    if (found) {
                        getEtherpadGroupFromNormalGroup(fields.groupId, function (success, group) {
                            if (!success) {
                                sendError('Server Error!', res);
                                return;
                            }
                            addUserToEtherpad(req.session.userId, function (etherpad_author) {
                                sessionManager.createSession(group, etherpad_author.authorID, Date.now() +
                                    7200000, function (err, session) {
                                    var data = {};
                                    data.success = true;
                                    data.session = session.sessionID;
                                    data.group = group;
                                    data.pad_name = fields.padname;
                                    data.location = fields.location;
                                    res.send(data);
                                });
                            });
                        });
                    } else {
                        sendError('User not in Group', res);
                    }
                });

            } else {
                res.send("You are not logged in!!");

            }
        });
    });

    args.app.get('/group.html/:group_id/pad.html/:padID', function (req, res) {
        var isAuthenticated = userAuthenticated(req);
        getGroup(req.params.group_id, function (success, currGroup) {
            getUser(req.session.userId, function (success, currUser) {
                var padID = req.params.padID;
                var slice = padID.indexOf("$");
                padID = padID.slice(slice + 1, padID.length);
                var padsql = "select * from GroupPads as gp where gp.pad_name = ?";
                existValueInDatabase(padsql, [padID], function (found) {
                    var render_args;

                    if (!found) {
                        render_args = {
                            errors: [],
                            msg: "This pad does not exist! It might have been deleted.",
                            footer: getFooter()
                        };
                        res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
                        return;
                    }

                    if (!(currGroup && currGroup.length > 0)) {
                        render_args = {
                            errors: [],
                            msg: "This group does not exist! It might have been deleted.",
                            footer: getFooter()
                        };
                        res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
                        return;
                    }

                    if (!isAuthenticated) {
                        render_args = {
                            errors: [],
                            padname: req.params.padID,
                            username: req.session.username,
                            groupID: req.params.group_id,
                            groupName: currGroup[0].name,
                            padurl: req.session.baseurl + "p/" + req.params.padID,
                            header: getHeader(req.session.username, ''),
                            footer: getFooter()
                        };
                        res.send(eejs.require("ep_user_pads/templates/pad_with_login.ejs", render_args));
                        return;
                    }

                    if (!currUser) {
                        res.send("Error");
                        return;
                    }

                    // all checks DONE
                    render_args = {
                        errors: [],
                        padname: padID,
                        username: currUser[0].FullName,
                        groupid: req.params.group_id,
                        groupName: currGroup[0].name,
                        padurl: req.session.baseurl + "p/" + req.params.padID,
                        header: getHeader(currUser[0].FullName, ''),
                        footer: getFooter()
                    };
                    res.send(eejs.require("ep_user_pads/templates/pad.ejs", render_args));
                });
            });
        });
    });

    args.app.get('/imprint.html', function (req, res) {
        var render_args = {
            errors: []
        };
        res.send(eejs.require("ep_user_pads/templates/imprint.html", render_args));
    });

    args.app.get('/public_pad/:id', function (req, res) {
        var authenticated = userAuthenticated(req);
        var render_args;
        if (!authenticated) {
            render_args = {
                errors: [],
                padurl: "/p/" + req.params.id,
                header: getHeaderNotLogged(),
                footer: getFooter()
            };
            res.send(eejs.require("ep_user_pads/templates/public_pad.ejs", render_args));
            return;
        }
        getUser(req.session.userId, function (success, currUser) {
            render_args = {
                errors: [],
                padurl: "/p/" + req.params.id,
                username: currUser[0].FullName,
                padName: req.params.id,
                header: getHeader(currUser[0].FullName, ''),
                footer: getFooter()
            };
            res.send(eejs.require("ep_user_pads/templates/public_pad_logged_in.ejs", render_args));
        });
    });

    args.app.post('/login', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            if (!fields.email) {
                sendError('No valid E-mail Address given', res);
                return;
            } else if (!fields.password) {
                sendError('No password given', res);
                return;
            }

            var email = fields.email;
            var password = fields.password;

            userAuthentication(email, password, function (success, user, userFound, considered, active) {
                if (success) {
                    req.session.email = email;
                    req.session.password = password;
                    req.session.userId = user.id;
                    req.session.username = user.FullName;
                    req.session.baseurl = fields.url;
                    var data = {};
                    data.success = true;
                    res.send(data);
                    return true;
                }

                if (!userFound) {
                    sendError('User or password wrong!', res);
                    return;
                }
                if (!active) {
                    sendError('User is inactive', res);
                    return;
                }

                if (considered) {
                    sendError('User or password wrong!', res);
                } else {
                    sendError('You have to confirm your registration!', res);
                }
                return false;
            });
        });
    });

    args.app.post('/register', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var user = {};
            user.fullname = fields.fullname;
            user.email = fields.email;
            user.password = fields.password;
            user.passwordrepeat = fields.passwordrepeat;
            user.location = fields.location;
            registerUser(user, function (success, error) {
                if (!success) {
                    sendError(error, res);
                } else {
                    var data = {};
                    data.success = success;
                    data.error = error;
                    res.send(data);
                }
            });
        });
    });

    args.app.post('/logout', function (req, res) {
        req.session.email = null;
        req.session.password = null;
        req.session.userId = null;
        req.session.username = null;
        res.send(true);
    });

    args.app.get('/confirm/:consString', function (req, res) {
        var sql = "Select * from User as u where u.considerationString = ?";
        getOneValueSql(sql, [req.params['consString']], function (found, users) {
            var render_args;
            if (!found) {
                render_args = {
                    errors: [],
                    msg: "User not found!",
                    footer: getFooter()
                };
                res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
            } else {
                if (users[0]['considered']) {
                    render_args = {
                        errors: [],
                        msg: 'User already confirmed!',
                        footer: getFooter()
                    };
                    res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
                } else {
                    var sql2 = "Update User SET considered = 1 WHERE id = ?";
                    updateSql(sql2, [users[0].id], function (success) {
                        if (success) {
                            // login
                            req = loginUser(req, users[0]);
                            var render_args = {
                                errors: [],
                                msg: 'Thanks for your registration!',
                                footer: getFooter()
                            };
                            res.send(eejs.require("ep_user_pads/templates/msgtemplate.ejs", render_args));
                        } else {
                            res.send('Something went wrong');
                        }
                    });
                }
            }
        });
    });

    args.app.post('/getUser', function (req, res) {
        var authenticated = userAuthenticated(req);
        if (authenticated) {
            getUser(req.session.userId, function (found, currUser) {
                var data = {};
                data.success = true;
                data.user = currUser;
                res.send(data);
            });
        } else {
            res.send("You are not logged in!!");
        }
    });


    args.app.post('/createGroup', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            if (err) {
                log('error', '/createGroup failed because of invalid form!');
                log('error', err);
                sendError("Form data error!!");
                return;
            }
            var isAuthed = userAuthenticated(req);
            if (!isAuthed) {
                sendError("You are not logged in!!");
                return;
            }
            if (!fields.groupName) {
                sendError("Group Name not defined", res);
                return;
            }

            var addGroupSql = "INSERT INTO Groups VALUES(null, ?)";
            pool.query(addGroupSql, [fields.groupName], function (err, result) {
                if (err) {
                    mySqlErrorHandler(err);
                    sendError("Server Error!", res);
                    return;
                }
                var newGroupID = result.insertId;
                var addUserGroupSql = "INSERT INTO UserGroup Values(?,?,1)";
                pool.query(addUserGroupSql, [req.session.userId, newGroupID], function (err) {
                    if (err) {
                        mySqlErrorHandler(err);
                        sendError("Server Error!", res);
                        return;
                    }
                    groupManager.createGroupIfNotExistsFor(newGroupID.toString(), function (err) {
                        if (err) {
                            log('error', 'failed to createGroupIfNotExistsFor');
                            log('error', err);
                            sendError("Server Error!", res);
                            return;
                        }
                        res.send({success: true, groupid: newGroupID});
                    });

                });

            });
        });
    });

    args.app.post('/createPad', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            if (err) {
                log('error', 'formidable parsing error in ' + req.path);
                sendError('Form Error!', res);
                return;
            }
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                res.send("You are not logged in!!");
            } else if (!fields.groupId) {
                sendError('Group-Id not defined', res);
                return;
            } else if (!fields.padName) {
                sendError('Pad Name not defined', res);
                return;
            }
            var existPadInGroupSql = "SELECT * from GroupPads as gp where gp.group_id = ? and gp.pad_name = ?";
            getOneValueSql(existPadInGroupSql, [fields.groupId, fields.padName], function (found) {
                if (found || (fields.padName.length == 0)) {
                    sendError('Pad already Exists', res);
                } else {
                    var addPadToGroupSql = "INSERT INTO GroupPads VALUES(?, ?)";
                    pool.query(addPadToGroupSql, [fields.groupId, fields.padName], function (err) {
                        if (err) {
                            mySqlErrorHandler(err);
                            sendError('Server Error!', res);
                            return;
                        }
                        addPadToEtherpad(fields.padName, fields.groupId, function () {
                            res.send({success: true});
                        });
                    });
                }
            });
        });
    });

    args.app.post('/deletePad', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            if (err) {
                log('error', 'formidable parsing error in ' + req.path);
                sendError('Form Error!', res);
                return;
            }
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                res.send("You are not logged in!!");
                return;
            } else if (!fields.groupId) {
                sendError('Group-Id not defined', res);
                return;
            } else if (!fields.padName) {
                sendError('Pad Name not defined', res);
                return;
            }
            var isOwnerSql = "SELECT * from UserGroup AS ug WHERE ug.user_id = ? and ug.group_id = ?";
            getAllSql(isOwnerSql, [req.session.userId, fields.groupId], function (userGroup) {
                if (!(userGroup[0]['role_id'] == 1)) {
                    sendError('User is not owner! Can not delete Pad', res);
                    return;
                }
                var deletePadSql = "DELETE FROM GroupPads WHERE pad_name = ? and group_id = ?";
                pool.query(deletePadSql, [fields.padName, fields.groupId], function (err) {
                    if (err) {
                        mySqlErrorHandler(err);
                        sendError('Server Error!', res);
                        return;
                    }
                    deletePadFromEtherpad(fields.padName, fields.groupId, function () {
                        res.send({success: true});
                    });
                });
            });
        });
    });

    args.app.post('/deleteGroup', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            if (err) {
                log('error', 'formidable parsing error in ' + req.path);
                sendError('Form Error!', res);
                return;
            }
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                res.send("You are not logged in!!");
                return;
            } else if (!fields.groupId) {
                sendError('Group-Id not defined', res);
                return;
            }
            var isOwnerSql = "SELECT * from UserGroup AS ug WHERE ug.user_id = ? and ug.group_id = ?";
            getAllSql(isOwnerSql, [req.session.userId, fields.groupId], function (userGroup) {
                if (userGroup.length == 0) {
                    sendError('You are not in this Group.', res);
                    return;
                } else if (!(userGroup[0]['role_id'] == 1)) {
                    sendError('User is not Owner. Can not delete Group', res);
                    return;
                }
                var deleteGroupSql = "DELETE FROM Groups WHERE id = ?";
                pool.query(deleteGroupSql, [fields.groupId], function (err) {
                    if (err) {
                        mySqlErrorHandler(err);
                        sendError('Server Error!', res);
                        return;
                    }
                    deleteGroupFromEtherpad(fields.groupId, function () {
                        res.send({success: true});
                    });
                });
            });
        });
    });


    args.app.post('/setPassword', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var authenticated = userAuthenticated(req);
            if (!authenticated) {
                res.send("You are not logged in!!");
                return
            } else if (!fields.groupId) {
                sendError('Group-Id not defined', res);
                return;
            }
            var isOwnerSql = "SELECT * from UserGroup AS ug WHERE ug.user_id = ? and ug.group_id = ?";
            getAllSql(isOwnerSql, [req.session.userId, fields.groupId], function (userGroup) {
                if (!(userGroup[0]['role_id'] == 1) || fields.pw == '') {
                    sendError('User is not owner! Can not set Password', res);
                    return;
                }
                getEtherpadGroupFromNormalGroup(fields.groupId, function (success, group) {
                    if (!success) {
                        sendError('Server Error!', res);
                        return;
                    }
                    padManager.getPad(group + "$" + fields.padName, null, function (err, origPad) {
                        if (err) {
                            log('error', err);
                            return;
                        }
                        origPad.setPassword(fields.pw);
                        res.send({success: true});
                    });
                });
            });
        });
    });
    return cb();
};

exports.eejsBlock_indexWrapper = function (hook_name, args, cb) {
    args.content = eejs.require("ep_user_pads/templates/index_redirect.ejs");
    return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
    return cb();
};
