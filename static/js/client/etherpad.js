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

var getBaseURL = function (slice, cb) {
    var loc = document.location,
        url = loc.protocol + "//" + loc.hostname + ":" + loc.port,
        pathComponents = location.pathname.split('/'),
        baseURL = pathComponents.slice(0, pathComponents.length - slice).join('/') + '/';
    cb(url + baseURL);
};

var first = true;


function post(data, url, cb) {
    $.ajax({
        type: 'POST',
        data: JSON.stringify(data),
        contentType: 'application/json',
        url: url,
        success: function (data) {
            cb(data);
        },
        //error: function (xhr, ajaxOptions, thrownError) {
        error: function () {
            cb(null);
        }
    });
}

function getSlice(cb) {
    var slice;
    if (window.location.href.indexOf("$") > -1)
        slice = 4;
    else if (window.location.href.indexOf("group.html") > -1)
        slice = 2;
    else if (window.location.href.indexOf("public_pad") > -1)
        slice = 2;
    else
        slice = 1;
    cb(slice);
}

// Validate function, checks if the input field is empty
// @tag: name of the tag
function validate(tag) {
    $(tag + " input").each(function () {
        if ($(this).val().length < 1) {
            if (!$(this).next().hasClass("errorRight")) {
                $(this).parent().append('<div class="errorRightLong"><span class="arrowRight"></span><span lang="en">Field is required!</span></div>');
                $(".errorRightLong").delay(2000).fadeOut(1000);
            }
        } else {
            $(this).next().remove();
        }
    });
}

function openLightboxWithProfileData(user) {
    $("#wrapper")
        .append('<div id="overlay"></div>')
        .append('<div id="lightBox"><div id="lightBoxHeader"><span class="close">' +
            '<img src="./../../../static/plugins/ep_user_pads/static/images/close-cyan-12.png">' +
            '</span></div><div id="lightBoxMain"><div class="headline"><img src="./../../../static/plugins/ep_user_pads/static/images/user-32.png"' +
            ' class="headlineImage" alt="User Details"><h1 lang="en">User Details</h1></div><div class="content">' +
            '<h3 lang="en">Full Name</h3><form id="formUsername"><div class="inputField"><input type="text" lang="en" placeholder="'
            + user.user[0]['FullName'] +
            '" id="newUserName" class="marginRight longInput smallMarginBottom"></div><button type="submit" class="marginBottom">Change</button></form><h3 lang="en">E-Mailaddress</h3>' +
            '<form id="formUseremail"><div class="inputField"><input type="text" id="newEmail" lang="en" placeholder="'
            + user.user[0]['name'] + '"' +
            ' class="marginRight longInput smallMarginBottom"></div><button type="submit" class="marginBottom">Change</button>' +
            '</form><h3 lang="en">Change Password</h3><form id="formUserpassword"><div class="inputField"><input type="password" ' +
            'lang="en" placeholder="Old Password" id="oldPW" class="marginRight longInput smallMarginBottom"></div><div class="inputField">' +
            '<input type="password" lang="en" placeholder="New Password" id="newPW" class="marginRight longInput smallMarginBottom">' +
            '</div><div class="inputField"><input type="password" lang="en" placeholder="Repeat Password" id="newRepPW" class="marginRight ' +
            'longInput smallMarginBottom"></div><button type="submit" lang="en" class="marginBottom">Change</button></form>' +
            '<h3 lang="en" class="clearMargin">Delete Account & Data</h3><span lang="en" class="deleteInfo">' +
            'Deletes all your Groups and Pads</span><button id="deleteData">Delete</button></div></div></div>');

    var $lb = $("#lightBox");
    $lb.css("margin-top", -$lb.height() / 2);

    // click-event for the closing of the lightBox		
    $(".close").click(function () {
        $("#overlay").remove();
        $("#lightBox").remove();
    });

    // confirmation for delete data			
    $("#deleteData").click(function () {
        $("#lightBox").remove();

        //$("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"></span></div><div id="lightBoxMain"><div class="headline"><img src="images/close-red-32.png" class="headlineImage" alt="Delete"><h1 lang="en" class="red">Delete not possible</h1></div><div class="content"><p>Delete not possible, because you have groups where you are owner.<br>Change ownership!</p></div></div></div>');
        $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close">' +
            '<img src="./../../../static/plugins/ep_user_pads/static/images/close-cyan-12.png">' +
            '</span></div><div id="lightBoxMain"><div class="headline">' +
            '<img src="./../../../static/plugins/ep_user_pads/static/images/close-red-32.png" class=' +
            '"headlineImage" alt="Delete"><h1 lang="en"' +
            'class="red">Delete all your groups and pads</h1></div><div class="content"><button id="deleteBtn" lang="en"' +
            'class="marginRight">Delete</button><button id="cancelBtn" lang="en">Cancel</button></div></div></div>');
        $("#lightBox").css("margin-top", -$("#lightBox").height() / 2);

        $("#deleteBtn").click(function (e) {
            e.preventDefault();
            getSlice(function (slice) {
                getBaseURL(slice, function (baseurl) {
                    var data = {};
                    post(data, baseurl + 'deleteUser', function (data) {
                        if (data.success) {
                            document.location.reload();
                        } else {
                            $("#lightBox").append('<div class="errorRight"><span class="arrowRight"></span><span lang="en">' + data.error + '</span></div>');
                            $(".errorRight").delay(2000).fadeOut(1000);
                        }
                    });
                });
            });

        });

        $("#cancelBtn").click(function () {
            $("#overlay").remove();
            $("#lightBox").remove();
        });

        // click-event for the closing of the lightBox		
        $(".close").click(function () {
            $("#overlay").remove();
            $("#lightBox").remove();
        });


    });

    // validation of the login
    // TODO: correct reaction on the validation			
    $("#formUsername").submit(function (e) {
        e.preventDefault();
        validate("#formUsername");
        var data = {};
        getSlice(function (slice) {
            getBaseURL(slice, function (baseurl) {
                data.newUserName = $("#newUserName").val();
                data.location = baseurl;
                post(data, baseurl + 'changeUserName', function (data) {
                    if (data.success) {
                        document.location.reload();
                    } else {
                        // todo: error handling?
                    }
                });
            });
        });
    });

    // validation of the login
    // TODO: correct reaction on the validation			
    $("#formUseremail").submit(function (e) {
        e.preventDefault();
        validate("#formUseremail");
        var data = {};
        getSlice(function (slice) {
            getBaseURL(slice, function (baseurl) {
                data.newEmail = $("#newEmail").val();
                data.location = baseurl;
                post(data, baseurl + 'changeEmail', function (data) {
                    if (data.success) {
                        document.location.reload();
                    } else {
                        // todo: error handling?
                    }
                });
            });
        });
    });

    // validation of the login
    // TODO: correct reaction on the validation			
    $("#formUserpassword").submit(function (e) {
        e.preventDefault();
        validate("#formUserpassword");
        var data = {};
        if ($("#newPW").val() != $("#newRepPW").val()) {
            if (!$("#newRepPW").next().hasClass("errorRight")) {
                $("#newRepPW").parent().append('<div class="errorRightLong"><span class="arrowRight"></span><span lang="en">Passwords do not agree!</span></div>');
                $(".errorRightLong").delay(2000).fadeOut(1000);
            }
            return;
        }
        $("#newPW").next().remove();
        getSlice(function (slice) {
            getBaseURL(slice, function (baseurl) {
                data.newPW = $("#newPW").val();
                data.oldPW = $("#oldPW").val();
                data.location = baseurl;
                post(data, baseurl + 'changeUserPw', function (data) {
                    if (data.success) {
                        document.location.reload();
                        return;
                    }
                    if (!$("#newRepPW").next().hasClass("errorRight")) {
                        $("#newRepPW").parent().append('<div class="errorRightLong"><span class="arrowRight"></span><span lang="en">' + data.error + '</span></div>');
                        $(".errorRightLong").delay(2000).fadeOut(1000);
                    }
                });
            });
        });
    });
}

$(document).ready(function () {
    /*
     * User Profile
     */

    // when the user name is clicked, the lightbox with the profile data appears
    $("#userProfile").click(function () {
        getSlice(function (slice) {
            getBaseURL(slice, function (baseurl) {
                post({}, baseurl + 'getUser', openLightboxWithProfileData);
            });
        });
    });


    /*
     * Groups
     * 
     */

    function createUserManagement(users, selectedUserVal, groupID, cb) {
        console.log(users);
        var startVars = {
            selUsersValAttrib: (selectedUserVal == "") ? '' : 'value="' + selectedUserVal + '" ',
            groupID: groupID
        };
        var startValue = '<div id="lightBox"><div id="lightBoxHeader"><span class="close">' +
            '<img src="./static/plugins/ep_user_pads/static/images/close-cyan-12.png"></span></div>' +
            '<div id="lightBoxMain" data-groupid= "%{groupID}" ><div class="headline">' +
            '<img src="./static/plugins/ep_user_pads/static/images/user-32.png" class="headlineImage" alt="Login">' +
            '<h1 lang="en">User Management</h1></div>' +
            '<div class="content"><h3 lang="en">Add User</h3><div id= "wait">' +
            '<form id = "selUsersForm">' +
            '<input type="text" lang="en" placeholder="E-Mailaddress(es)" {selUsersValAttrib} id="selectedUsers" class="marginRight" longInput>' +
            '<button id="invitebtn" type="submit">Add User</button>' +
            '<span lang="en" class="inviteInfo">If there are more than one, separate with ;</span></form></div>' +
            '<h3 lang="en">Manage Members</h3>';
        var value = Kiwi.compose(startValue, startVars);

        if (users.length == 0) {
            value += '<h4 class="red" lang="en">No user in this group.</h4>';
        } else {
            value += '<form style="margin-bottom:5px">' +
                '<input type="text" id="searchU" placeholder="Search"></form>' +
                '<div class="tableview" style="height: 157px; overflow: hidden"><table>';

            for (var i = 0; i < users.length; i++) {
                var baseClasses = (i % 2 == 1) ? "visible" : "odd visible";
                var vars = {
                    user_id: users[i].id,
                    user_name: users[i].name,
                    tr_class: baseClasses,
                    groupID: groupID,
                    full_name: users[i]['FullName'],
                    display_name: users[i]['FullName'],
                    extra_attribs: '',
                    status_tag: ''
                };
                if (users[i].notRegistered) {
                    vars.tr_class = "grey visible";
                    vars.display_name = vars.user_name;
                    vars.status_tag = '(Invited)';
                    vars.extra_attribs = 'data-toinvite="1"';
                } else if (users[i]['role_id'] == 1) {
                    vars.status_tag = '(Owner)';
                } else if (users[i]['invited']) {
                    vars.tr_class = "grey visible";
                    vars.status_tag = '(Invited)';
                    vars.display_name = vars.user_name;
                }
                var template = '<tr class="%{tr_class}" id="User%{user_id}">' +
                    '<td class="first"><span id="userEmail" data-mail="%{user_name}" data-userid="%{user_id}" %{extra_attribs}>%{display_name} <span class="smallFont">%{status_tag}</span></span></td>' +
                    '<td class="last right" id="options"  data-groupid="%{groupID}"><img src="./static/plugins/ep_user_pads/static/images/options-16.png" class = "options" data-groupid="%{groupID}" data-userid="%{user_id}"></td>' +
                    '</tr>';
                value += Kiwi.compose(template, vars);
            }
            value += '</table></div><div class="navigationInfo">' +
                '<span id="previousPageU" class="pointer">&#9664;</span> ' +
                '<span id="currentPageU"></span> to <span id="currentPageCountU"></span>' +
                ' of <span id="pageCountU"></span> Users ' +
                '<span id="nextPageU" class="pointer">&#9654;</span></div>';
        }
        value += '</div></div></div>';
        cb(value);
    }

    function submitHandler() {
        $("#selUsersForm").submit(function (e) {
            e.preventDefault();
            var data = {};
            getBaseURL(1, function (baseurl) {
                var users = $("#selectedUsers").val();
                users = users.split(';');
                data.users = users;
                data.location = baseurl;
                data.groupID = $("#lightBoxMain").data('groupid');
                post(data, baseurl + 'inviteUsers', function (data) {
                    if (data.success) {
                        $("#overlay").remove();
                        $("#lightBox").remove();
                        $("#wrapper").append('<div id="overlay"></div>');
                        if (!data.success) {
                            $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"><img src="./../../static/plugins/ep_user_pads/static/images/close-cyan-12.png"></span></div><div id="lightBoxMain"><div class="headline"><img src="./../../static/plugins/ep_user_pads/static/images/user-32.png" class="headlineImage" alt="Register"><h1>Failure</h1></div><div class="content"><label>' + data.error + '</label></div></div></div>');
                        } else {
                            $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"><img src="./../../static/plugins/ep_user_pads/static/images/close-cyan-12.png"></span></div><div id="lightBoxMain"><div class="headline"><img src="./../../static/plugins/ep_user_pads/static/images/user-32.png" class="headlineImage" alt="Register"><h1>User Successfully added</h1></div><div class="content"><label>The given User are now added to the group.</label></div></div></div>');
                        }
                        $("#lightBox").css("margin-top", -$("#lightBox").height() / 2);
                        $(".close").click(function () {
                            window.location.reload();
                        });
                    } else {
                        $("#waitImg").remove();
                        $("#err").remove();
                        $("#invitebtn").after('<div id="err" class="errorUp"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
                        $(".errorUp").delay(2000).fadeOut(1000);
                    }
                });
            });
        });
    }

    function handler2() {
        $("#lightBox").css("margin-top", -$("#lightBox").height() / 2);

        $(".close").click(function () {
            first = true;
            document.location.reload();
            $("#overlay").remove();
            $("#lightBox").remove();
        });

        $(".options").click(function () {
//			console.log($(this).parent().parent().find('#userEmail').data('mail'));
            //console.log();
            if (!($("#overlayOptions").length > 0)) {
                if ($(this).parent().parent().find('#userEmail').data('toinvite')) {
                    $(this).parent().append('<div id="overlayOptions" data-groupid="' + $(this).parent().parent().find('#options').data('groupid') + '"><img src="./static/plugins/ep_user_pads/static/images/arrow.png"' +
                        'class="arrow"><ul><li><a href="mailto:' + $(this).parent().parent().find('#userEmail').data('mail') + '" id="mail"><img src="./static/plugins/ep_user_pads/static/images/mail-16.png" ' +
                        'alt="Send a Mail" class="smallIcon" >Mail</a></li><li><a href="" id="reinvite" data-groupid="' + $(this).parent().parent().find('#options').data('groupid') + '" data-username="' + $(this).parent().parent().find('#userEmail').data('mail') + '"><img src="./static/plugins/ep_user_pads/static/images/backarrow-16.png" class="smallIcon">Reinvite</a></li><li><a href="" id="deleteNotRegUser" data-groupid="' + $(this).parent().parent().find('#options').data('groupid') + '" data-username="' + $(this).parent().parent().find('#userEmail').data('mail') + '"><img src="./static/plugins/ep_user_pads/static/images/close-red-16.png"' +
                        'alt="Delete User" class="smallIcon" ><span class="red">Delete<span></a></li></ul></div></div>');
                }
                else if ($('#Gruppe' + $(this).data('groupid')).data('role') == 1) {
                    $(this).parent().append('<div id="overlayOptions" data-groupid="' + $(this).parent().parent().find('#options').data('groupid') + '"><img src="./static/plugins/ep_user_pads/static/images/arrow.png"' +
                        'class="arrow"><ul><li><a href="mailto:' + $(this).parent().parent().find('#userEmail').data('mail') + '" id="mail"><img src="./static/plugins/ep_user_pads/static/images/mail-16.png" ' +
                        'alt="Send a Mail" class="smallIcon" >Mail</a></li><li><a href="" id="makeOwner" data-userid="' + $(this).parent().parent().find('#userEmail').data('userid') + '">' +
                        '<img src="./static/plugins/ep_user_pads/static/images/flag-16.png" alt="Make this person Owner" ' +
                        'class="smallIcon" >Make Owner</a></li><li><a href="" id="deleteUser" data-userid="' + $(this).parent().parent().find('#userEmail').data('userid') + '"><img src="./static/plugins/ep_user_pads/static/images/close-red-16.png"' +
                        'alt="Delete User" class="smallIcon" ><span class="red">Delete<span></a></li></ul></div></div>');
                } else if ($('#Gruppe' + $(this).data('groupid')).data('role') == 2) {
                    $(this).parent().append('<div id="overlayOptions" data-groupid="' + $(this).parent().parent().find('#options').data('groupid') + '"><img src="./static/plugins/ep_user_pads/static/images/arrow.png"' +
                        'class="arrow"><ul><li><a href="mailto:' + $(this).parent().parent().find('#userEmail').data('mail') + '" id="mail"><img src="./static/plugins/ep_user_pads/static/images/mail-16.png" ' +
                        'alt="Send a Mail" class="smallIcon" >Mail</a></li></ul></div></div>');
                }
                $("#reinvite").click(function (e) {
                    e.preventDefault();
                    var username = $(this).data('username');
                    var groupID = $(this).data('groupid');
                    var data = {};
                    var url;
                    getBaseURL(1, function (baseurl) {
                        url = baseurl;
                        data.username = username;
                        data.groupID = groupID;
                        data.location = url;
                        post(data, url + 'reinviteUser', function (data) {
                            if (data.success) {
                                document.location.reload();
                            } else {
                                //console.log(data.error);
                                $("#overlay").remove();
                                $("#lightBox").remove();
                            }
                        });
                    });
                });

                $("#deleteNotRegUser").click(function (e) {
                    e.preventDefault();
                    var username = $(this).data('username');
                    var groupID = $(this).data('groupid');
                    var data = {};
                    var url;
                    getBaseURL(1, function (baseurl) {
                        url = baseurl;
                        data.username = username;
                        data.groupID = groupID;
                        post(data, url + 'deleteNotRegUser', function (data) {
                            if (data.success) {
                                document.location.reload();
                            } else {
                                //console.log(data.error);
                                $("#overlay").remove();
                                $("#lightBox").remove();
                            }
                        });
                    });
                });


                $("#makeOwner").click(function (e) {
                    e.preventDefault();
                    var userID = $(this).data('userid');
                    var userFullName = $(this).parent().parent().parent().parent().parent().find('#userEmail').html();
                    var groupID = $(this).parent().parent().parent().parent().find('#overlayOptions').data('groupid');
                    $("#lightBox").remove();

                    //$("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"></span></div><div id="lightBoxMain"><div class="headline"><img src="images/close-red-32.png" class="headlineImage" alt="Delete"><h1 lang="en" class="red">Delete not possible</h1></div><div class="content"><p>Delete not possible, because you have groups where you are owner.<br>Change ownership!</p></div></div></div>');
                    $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close">' +
                        '<img src="./../../../static/plugins/ep_user_pads/static/images/close-cyan-12.png">' +
                        '</span></div><div id="lightBoxMain"><div class="headline">' +
                        '</h1>Note: If you make the user \'' + userFullName + '\' to the owner of this group, you loose the possibility to delete the group, its users and its pads. Are you sure?</div><div class="content"><button id="makeOwnBtn" lang="en"' +
                        'class="marginRight">Yes</button><button id="cancelBtn" lang="en">Cancel</button></div></div></div>');
                    $("#lightBox").css("margin-top", -$("#lightBox").height() / 2);

                    $("#makeOwnBtn").click(function (e) {
                        e.preventDefault();
                        var data = {};
                        var url;
                        getBaseURL(1, function (baseurl) {
                            url = baseurl;
                            data.userID = userID;
                            data.groupID = groupID;
                            post(data, url + 'makeOwner', function (data) {
                                if (data.success) {
                                    document.location.reload();
                                } else {
                                    //console.log(data.error);
                                    $("#overlay").remove();
                                    $("#lightBox").remove();
                                }
                            });
                        });

                    });

                    $("#cancelBtn").click(function () {
                        $("#overlay").remove();
                        $("#lightBox").remove();
                        document.location.reload();
                    });

                    // click-event for the closing of the lightBox		
                    $(".close").click(function () {
                        $("#overlay").remove();
                        $("#lightBox").remove();
                        document.location.reload();
                    });
                });

                $("#deleteUser").click(function (e) {
                    e.preventDefault();
                    var userID = $(this).data('userid');
                    var groupID = $(this).parent().parent().parent().parent().find('#overlayOptions').data('groupid');
                    var data = {};
                    var url;
                    getBaseURL(1, function (baseurl) {
                        url = baseurl;
                        data.userID = userID;
                        data.groupID = groupID;
                        post(data, url + 'deleteUserFromGroup', function (data) {

                            if (data && data.success) {
                                document.location.reload();
                            } else {
                                //console.log(data.error);
                                $("#overlay").remove();
                                $("#lightBox").remove();
                            }
                        });
                    });
                });

                $("#reinvite").click(function (e) {
                    e.preventDefault();
                });

            } else {
                $("#overlayOptions").remove();
            }
        });

        $(document).click(function (e) {
            if (!$(".options").is(e.target)) {
                $("#overlayOptions").remove();
            }
        });
    }

    function handler() {


        $('#searchU').keyup(function () {
            /// search
            $(".content table tr").each(function () {
                if ($(this).children("td.first").children("span").text().toLowerCase().match($("#searchU").val().toString().toLowerCase())) {
                    $(this).show();
                    $(this).addClass("visible")
                } else {
                    $(this).removeClass("visible");
                    $(this).hide();
                }
            });

            // set color of the rows new after the search results are showen
            var i = 0;
            $(".content table tr").each(function () {
                $(this).removeClass("odd");
                if ($(this).css("display") == "table-row") {
                    if (i % 2 == 0) {
                        $(this).addClass("odd")
                    }
                    i++;
                }
            });

            if ($('#searchU').val().length == 0) {
                buildPage(0);
            }

            initPaging(6);
        });

        /*
         * Pageing
         *
         */

        var rowsize = 6;
        initPaging(rowsize);
        var page = 0;

        // jump to the next page
        $("#nextPageU").click(function () {
            page++;
            buildPage(page);

            if ($(".content table tr.visible").length <= (page + 1) * rowsize) {
                $("#nextPageU").hide();
            }

            $("#previousPageU").show();
            if ($(".content table tr.visible").length > rowsize + page * rowsize) {
                updatePaging(page * rowsize + 1, rowsize + page * rowsize)
            } else {
                updatePaging(page * rowsize + 1, $(".content table tr.visible").length)
            }
        });

        // jump to the previous page
        $("#previousPageU").click(function () {
            page--;
            buildPage(page);

            if (page == 0) {
                $("#previousPageU").hide();
            }

            $("#nextPageU").show();
            updatePaging(page * rowsize + 1, rowsize + page * rowsize)
        });

        /*
         * Build the Page depending on the pageview number
         */
        function buildPage(page) {
            var i = 0;
            $(".content table tr.visible").each(function () {
                if (i >= (page * rowsize) && i <= ((rowsize - 1) + page * rowsize)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
                i++;
            });
        }

        /*
         * Update the value for the Paging
         */
        function updatePaging(currentPage, currentPageCount) {
            $("#currentPageU").html(currentPage);
            $("#currentPageCountU").html(currentPageCount);
        }

        /*
         * Initalize the Paging
         */

        function initPaging(rowsize) {
            // initalize the paging view
            //console.log(rowsize);
            page = 0;
            $("#nextPageU").hide();
            $("#previousPageU").hide();

            // set the correct start value for the pagging
            if ($(".content table tr.visible").length > rowsize) {
                $("#nextPageU").show();
                updatePaging(1, rowsize)
            } else if ($(".content table tr.visible").length == 0) {
                updatePaging(0, $(".content table tr.visible").length)
            } else {
                updatePaging(1, $(".content table tr.visible").length)
            }

            // build first page
            buildPage(page);

            // set the value for the number of rows
            $("#pageCountU").html($(".content table tr.visible").length);
        }
    }


    $(".groupDetails").click(function (e) {
        if (first) {
            var data = {};
            var url;
            getBaseURL(1, function (baseurl) {
                url = baseurl;
                data.searchterm = '';
                data.location = url;
                var groupID = $(e.currentTarget).data('groupid');
                data.groupID = groupID;
                post(data, url + 'userSearchTerm', function (data) {
                    if (data.success) {
                        createUserManagement(data.users, "", groupID, function (val) {
                            $("#wrapper").append('<div id="overlay"></div>');
                            $("#wrapper").append(val);
                            handler();
                            handler2();
                            submitHandler();
                            first = false;
                            $(document).ready();
                        });
                    } else {
                        $("#overlay").remove();
                        $("#lightBox").remove();
                    }
                });
            });
        } else {
            handler();
            handler2();
            submitHandler();
        }
    });


    /*
     * Minimize and Maximize of the Header, groupNav und Footer Element in Pad View
     * 
     */

    // minimize the elements
    $("#minimize").click(function () {
        $('header').delay(0).slideUp(800);
        $('#groupNav').delay(0).slideUp(800);
        $('footer').delay(0).slideUp(800);
        $('#minimize').delay(0).slideUp(800);
        $('#maximize').delay(1200).slideDown(800);

        $("#iframePad").animate({height: $(window).height() - 4}, 800);
        $("#iframePad").css("display", "block");
    });

    // maximize the elements		
    $("#maximize").click(function () {
        $('header').delay(300).slideDown(800);
        $('#groupNav').delay(300).slideDown(800);
        $('footer').delay(300).slideDown(800);
        $('#minimize').delay(1500).slideDown(800);
        $('#maximize').delay(0).slideUp(800);

        $("#iframePad").delay(300).animate({height: $(window).height() - $("header").height() - $("#groupNav").height() - $("footer").height() - 8}, 800);
    });

    // adjust the height of the iframe 			
    $("#iframePad").css("height", $(window).height() - $("header").height() - $("#groupNav").height() - $("footer").height() - 8);
    $(window).resize(function () {
        if ($("header").css("display") != "none")
            $("#iframePad").css("height", $(window).height() - $("header").height() - $("#groupNav").height() - $("footer").height() - 8);
        else
            $("#iframePad").css("height", $(window).height() - 4);
    });

    // adjust the height of main > inside for the iframe (border of 4px )
    $("#iframePad").parent().css("height", $(window).height() - $("header").height() - $("#groupNav").height() - $("footer").height() - 4);
    $(window).resize(function () {
        $("#iframePad").parent().css("height", $(window).height() - $("header").height() - $("#groupNav").height() - $("footer").height() - 4);
    });

    $('#logout').click(function (e) {
        e.preventDefault();
        var data = {};
        var url;
        getSlice(function (slice) {
            getBaseURL(slice, function (baseurl) {
                url = baseurl;
                data.location = url;
                post(data, url + 'logout', function (data) {
                    if (data) {
                        window.location = url + "index.html";
                    } else {
                        console.log("Something went wrong");
                    }
                });
            });
        });
    });

    $('#search').keyup(function () {
        /// search
        $(".inputBlock table tr").each(function () {
            if ($(this).children("td.first").children("a").html().match($("#search").val())) {
                $(this).show();
                $(this).addClass("visible")
            } else {
                $(this).removeClass("visible");
                $(this).hide();
            }
        });

        // set color of the rows new after the search results are showen
        var i = 0;
        $(".inputBlock table tr").each(function () {
            $(this).removeClass("odd");
            if ($(this).css("display") == "table-row") {
                if (i % 2 == 0) {
                    $(this).addClass("odd")
                }
                i++;
            }
        });

        if ($('#search').val().length == 0) {
            buildPage(0);
        }

        initPaging(rowsize);
        /*e.preventDefault();
         //		console.log('enter');
         var data = {};

         var url;
         getBaseURL(1,function(baseurl){
         url = baseurl;
         data.searchterm= $('#search').val();
         data.location = url;
         post(data, url+'groupsSearchTerm' ,function(data){
         $('#table').html(data);
         $(document).ready();
         });
         });*/

    });

    /*
     * Pageing
     *
     */

    var rowsize = 6;
    var page = 0;
    initPaging(rowsize);

    // jump to the next page
    $("#nextPage").click(function () {
        page++;
        buildPage(page);

        if ($(".inputBlock table tr.visible").length <= (page + 1) * rowsize) {
            $("#nextPage").hide();
        }

        $("#previousPage").show();
        if ($(".inputBlock table tr.visible").length > rowsize + page * rowsize) {
            updatePaging(page * rowsize + 1, rowsize + page * rowsize)
        } else {
            updatePaging(page * rowsize + 1, $(".inputBlock table tr.visible").length)
        }
    });

    // jump to the previous page
    $("#previousPage").click(function () {
        page--;
        buildPage(page);

        if (page == 0) {
            $("#previousPage").hide();
        }

        $("#nextPage").show();
        updatePaging(page * rowsize + 1, rowsize + page * rowsize)
    });

    /*
     * Build the Page depending on the pageview number
     */
    function buildPage(page) {
        var i = 0;
        $(".inputBlock table tr.visible").each(function () {
            if (i >= (page * rowsize) && i <= ((rowsize - 1) + page * rowsize)) {
                $(this).show();
            } else {
                $(this).hide();
            }
            i++;
        });
    }

    /*
     * Update the value for the Paging
     */
    function updatePaging(currentPage, currentPageCount) {
        $("#currentPage").html(currentPage);
        $("#currentPageCount").html(currentPageCount);
    }

    /*
     * Initalize the Paging
     */
    function initPaging(rowsize) {
        // initalize the paging view
        $("#nextPage").hide();
        $("#previousPage").hide();

        // set the correct start value for the pagging
        if ($(".inputBlock table tr.visible").length > rowsize) {
            $("#nextPage").show();
            updatePaging(1, rowsize)
        } else if ($(".inputBlock table tr.visible").length == 0) {
            updatePaging(0, $(".inputBlock table tr.visible").length)
        } else {
            updatePaging(1, $(".inputBlock table tr.visible").length)
        }

        // build first page
        buildPage(page);

        // set the value for the number of rows
        $("#pageCount").html($(".inputBlock table tr.visible").length);
    }

    $('#searchPads').keypress(function (e) {

        if (e.which == 13) {
            e.preventDefault();
//			console.log('enter');
            var data = {};
            var url;
            getBaseURL(2, function (baseurl) {
                url = baseurl;
                data.searchterm = $('#searchPads').val();
                data.groupId = $('#searchPads').data('groupid');
                data.location = url;
                post(data, url + 'padSearchTerm', function (data) {
                    if (data.success) {
                        $('#tablePads').html(data.html);
                        $(document).ready();
                    } else {
                        console.log(data.error);
                    }
                });
            });
        } else {
        }
    });

    $('#createPublicPadByName').click(function (e) {
        e.preventDefault();
        var padname = $('#createPadName').val();
        if (padname.length > 0) {
            window.location = "public_pad/" + padname;
        } else {
            $("#createPublicPadByName").after('<div class="errorUp"><span class="arrowUp"></span><span lang="en">Please enter a name</span></div>');
            $(".errorUp").delay(2000).fadeOut(1000);
        }
    });

    function randomPadName() {
        var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var string_length = 10;
        var randomstring = '';
        for (var i = 0; i < string_length; i++) {
            var rnum = Math.floor(Math.random() * chars.length);
            randomstring += chars.substring(rnum, rnum + 1);
        }
        return randomstring;
    }

    $('#createPublicPadRandomName').click(function (e) {
        e.preventDefault();
        window.location = "public_pad/" + randomPadName();
    });

    $('#openPublicPad').click(function (e) {
        e.preventDefault();
        var padname = $('#padName').val();
        if (padname.length > 0) {
            window.location = "public_pad/" + padname;
        } else {
            $("#padName").parent().append('<div class="errorUp" style="margin-left:92px"><span class="arrowUp"></span><span lang="en">Please enter a name</span></div>');
            $(".errorUp").delay(2000).fadeOut(1000);
        }
    });
    
    $('#createPrivateGroupForm').submit(function (e) {
        e.preventDefault();
        var data = {};
        var url;
        getBaseURL(1, function (baseurl) {
            url = baseurl;
            data.location = url;
            data.groupName = $("#groupName").val();
            post(data, url + 'createGroup', function (data) {
                if (!data.success) {
                    if (data.error == "Group Name not defined") {
                        console.log(data.error);
                    }
                    $("#createPrivateGroupForm input").each(function () {
                        if ($(this).next().hasClass("errorUp"))
                            $(this).next().remove();
                        //if($(this).is('#createPrivateGroup') && !$(this).next().hasClass("errorUp") && data.error == 'Group already exists');
                        $(this).parent().append('<div class="errorUp"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
                        $("#createPrivateGroupForm .errorUp").delay(2000).fadeOut(1000);
                    });
                } else {
                    console.log(data);
                    $("#groupName").val('');
                    $("#wrapper").append('<div id="overlay"></div>');
                    $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"><img src="./../static/plugins/ep_user_pads/static/images/close-cyan-12.png"' +
                        '></span></div><div id="lightBoxMain" data-groupid= "' + data.groupid + '" ><div class="headline"><img src="./../static/plugins/ep_user_pads/static/images/user-32.png" class="' +
                        'headlineImage" alt="Login"><h1 lang="en">User Management</h1></div><div class="content"><h3 lang="en">Add User</h3><div id= "wait"><form id = "selUsersForm"><input type="text"' +
                        'lang="en" placeholder="E-Mailaddress(es)" id="selectedUsers" class="marginRight" longInput><button id="invitebtn" type="submit">Add User</button><span lang="en" class="inviteInfo"' +
                        '>If there are more than one, separate with ;</span></form></div>');

                    $("#lightBox").css("margin-top", -$("#lightBox").height() / 2);

                    // click-event for the closing of the lightBox
                    $(".close").click(function () {
                        $("#overlay").remove();
                        $("#lightBox").remove();
                        window.location.reload();
                    });

                    $("#selUsersForm").submit(function (e) {
                        e.preventDefault();
                        var data = {};
                        getBaseURL(1, function (baseurl) {
                            var users = $("#selectedUsers").val();
                            users = users.split(';');
                            url = baseurl;
                            data.users = users;
                            data.location = url;
                            data.groupID = $("#lightBoxMain").data('groupid');
                            console.log(data);
                            post(data, url + 'inviteUsers', function (data) {
                                if (data.success) {
                                    $("#overlay").remove();
                                    $("#lightBox").remove();
                                    $("#wrapper").append('<div id="overlay"></div>');
                                    if (!data.success) {
                                        $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"><img src="./../../static/plugins/ep_user_pads/static/images/close-cyan-12.png"></span></div><div id="lightBoxMain"><div class="headline"><img src="./../../static/plugins/ep_user_pads/static/images/user-32.png" class="headlineImage" alt="Register"><h1>Failure</h1></div><div class="content">\
						   	    						<label>' + data.error + '</label></div></div></div>');
                                    } else {
                                        $("#wrapper").append('<div id="lightBox"><div id="lightBoxHeader"><span class="close"><img src="./../../static/plugins/ep_user_pads/static/images/close-cyan-12.png"></span></div><div id="lightBoxMain"><div class="headline"><img src="./../../static/plugins/ep_user_pads/static/images/user-32.png" class="headlineImage" alt="Register"><h1>User Successfully Added</h1></div><div class="content">\
				   	    						<label>The given Users are now added to the group.</label></div></div></div>');
                                    }
                                    $("#lightBox").css("margin-top", -$("#lightBox").height() / 2);
                                    $(".close").click(function () {
                                        window.location.reload();
                                    });
                                } else {
                                    $("#waitImg").remove();
                                    $("#err").remove();
                                    $("#invitebtn").after('<div id="err" class="errorUp"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
                                    $(".errorUp").delay(2000).fadeOut(1000);
                                    console.log(data.error);
                                }
                            });
                        });
                    });
                }
            });
        });
    });

    $('#createPrivateGroupPad').click(function (e) {
        e.preventDefault();
        var data = {};
        var loc;
        getBaseURL(2, function (baseurl) {
            loc = document.location;
            data.location = baseurl;
            data.padName = $("#createGroupPad").val();
            data.groupId = $("#createPrivateGroupPad").data('groupid');
            post(data, baseurl + 'createPad', function (data) {
                if (!data.success) {
                    console.log(data.error);
                    $("#createPrivatePadForm input").each(function () {
                        if ($(this).next().hasClass("errorUp"))
                            $(this).next().remove();
                        $(this).parent().append('<div class="errorUp"><span class="arrowUp"></span><span lang="en">' + data.error + '</span></div>');
                        $("#createPrivatePadForm .errorUp").delay(2000).fadeOut(1000);
                    });
                } else {
                    window.location = loc;
                }
            });
        });
    });


    $('.padClick').click(function (e) {
        e.preventDefault();
        var groupId = $(this).data('groupid');
        var padname = $(this).data('name');
        var data = {};
        var url;
        getBaseURL(2, function (baseurl) {
            url = baseurl;
            data.location = url;
            data.groupId = groupId;
            data.padname = padname;
            post(data, url + 'directToPad', function (data) {
                document.cookie = "sessionID=" + data.session + "; path=/";
                window.location = window.location + "/pad.html/" + data.group + "$" + data.pad_name;
            });
        });
    });
});


