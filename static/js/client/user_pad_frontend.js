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
 convenience methods
 */
function getSocket(pattern) {
    var url = document.location.origin;
    var resource = 'socket.io';
    return window['io'].connect(url, {resource: resource}).of(pattern);
}

function index(hooks, context, cb) {
    getSocket("/pluginfw/user_pads_unlogged");

    function handlers() {
    }

    handlers();
}

exports.documentReady = function (hooks, context, cb) {
    if (context == "/user_pads/index")
        index(hooks, context, cb);
};


