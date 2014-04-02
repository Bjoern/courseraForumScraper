/*
 * Please note that the code might be a bit messy at times - it's more like a throwaway code thing...
 *
 */
var page = require('webpage').create();
var fs = require('fs')

var config = JSON.parse(fs.read("config.json"))

var loginName = config.user
var pwd = config.password

var course = config.course
var scrapedir = config.scrapedir

//this captures log output from javascript execution on opened pages
page.onConsoleMessage = function (msg) {
  console.log("*** log on page: "+msg);
};

var threads = []

if(fs.exists(scrapedir+'/threads.json')){
  threads = JSON.parse(fs.read(scrapedir+"/threads.json"))

  console.log("read: "+threads.length)
}

var threadsMap = {}

var threadIdsToUpdate = []

var lastTime = 0

threads.forEach(function(elem, index, arr){
    //console.log("read "+elem.id+", time: "+elem.last_updated_time+", lastTime: "+lastTime)
    if(elem.last_updated_time > lastTime){
      //console.log("update last time: "+lastTime)
      lastTime = elem.last_updated_time
    }
    threadsMap[elem.id+""] = elem

    if(!(fs.exists(scrapedir+'/posts'+elem.id+".js") && fs.exists(scrapedir+'/comments'+elem.id+'.js'))){
      console.log("no posts or comments found for thread "+elem.id+", queue for scraping")
      threadIdsToUpdate.push(elem.id)
    } else {
      console.log("thread "+elem.id+" already scraped")
    }
 })
console.log("threads on file: "+threads.length+", to scrape: "+threadIdsToUpdate.length)
console.log("last time: "+lastTime)

function dologin(callback){

  page.open('https://accounts.coursera.org/signin', function() {
      page.onError = function(msg, trace) {
        console.log("error on page")
        console.log(msg);
        trace.forEach(function(item) {
            console.log('  ', item.file, ':', item.line);
          });
      }

      page.onResourceRequested = function(request) {
        //console.log('Request ' + JSON.stringify(request, undefined, 4));
      };

      page.onResourceReceived = function(response) {
        //console.log('Receive ' + JSON.stringify(response, undefined, 4));
      };

      var pwdfield = null;

      var waitCount = 0;

      function waitForForm(){

        var isLoggedIn = login();

        if(isLoggedIn){
          setTimeout(callback, 2000);
        } else if(waitCount < 10){
          waitCount++;
          console.log("waiting "+waitCount);
          setTimeout(waitForForm, 1000);
        } else {
          console.log("giving up waiting for form after 10 seconds")
          finish();
        }
      }

      function login(){
        var script =  'function(){'+
          'var pwdfield = document.getElementById("signin-password");'+
          'if(pwdfield == null){return false;};'+

          'var loginfield = document.getElementById("signin-email");'+

          'pwdfield.value = "'+pwd+'";'+
          'loginfield.value = "'+loginName+'";'+

          'var elements = document.getElementsByClassName("coursera-signin-button");'+

          'elements[0].click();'+
          'return true;}'

        var isFormSubmitted = page.evaluate(script)

        return isFormSubmitted
      }


      //setTimeout(finish,10000);
      waitForForm();
    });
}

var pageNum = 1
var resultsPerPage = 100

var countNew = 0

//TODO better name...
function afterThreadsCollection(){
  collectAndSortThreads()
  writeThreads()
  scrapeCommentsForThreads(threadIdsToUpdate, finish)
}

function writeThreads(){
  console.log("write threads")
  
  fs.write(scrapedir+"/threads.json", JSON.stringify(threads))

  console.log("threads written")
}

function collectAndSortThreads(){
  threads = []

  for(threadId in threadsMap){
    threads.push(threadsMap[threadId])
  }

  console.log("collected "+threads.length+" threads")

  threads.sort(function(t1,t2){
      return t1.last_updated_time - t2.last_updated_time
    })

  console.log("threads sorted")
}

function scrapeCommentsForThreads(threadIds, callback){
  console.log("scrape comments for "+threadIds.length+" threads")

  if(threadIds.length == 0){
    console.log("all comments scraped")

    callback()
    return
  } 

  var threadId = threadIds.shift()

  //console.log("shifted thread: "+JSON.stringify(thread)

  console.log("scrape thread "+threadId+", remaining: "+threadIds.length)

  scrapeThread(threadId, function(){
          scrapeCommentsForThreads(threadIds, callback)
        })
 }

function scrapeThreads(callback){
  page.open('https://class.coursera.org/'+course+'/api/forum/forums/0/threads?sort=lastupdated&page='+pageNum+'&page_size='+resultsPerPage, function() {
      //console.log("*** threads: "+page.plainText)

      console.log("scrape page "+pageNum)

      var result = JSON.parse(page.plainText)

      console.log("maxpages: "+result.max_pages)
      console.log("threads received: "+result.threads.length)

      var hasOldThreads = false

      loop: for(var i = 0;i < result.threads.length;i++){
        var thread = result.threads[i]

        if(thread.last_updated_time > lastTime){
          console.log("update "+thread.id+", from "+thread.last_updated_time+", last: "+lastTime)
          threadIdsToUpdate.push(thread.id)
          countNew++
            threadsMap[thread.id+""] = thread
        } else {
          console.log("old thread found: "+thread.id+", title: "+thread.title)
          hasOldThreads = true
          break loop
        }

      }

      if(!hasOldThreads && pageNum < result.max_pages){
        pageNum++;
        scrapeThreads(callback);
        return;
      }

      setTimeout(callback, 1000)
    })

}

function scrapeThread(threadId, callback, posts, comments, lastPostId){
  console.log("scrape thread "+threadId)

  if(!posts){
    posts = []
    comments = []
  }

  var thread = threadsMap[threadId+""]

  //console.log("comments: "+thread.num_posts+"title: "+thread.title)
  var url = "https://class.coursera.org/behavioralecon-002/api/forum/threads/"+threadId+"?"
  if(lastPostId){
    url = url+"&post_id="+lastPostId+"&position=after"
  }
  url = url+"&sort=null"

  //console.log("open "+url)
  //if(fs.exists("scrape/posts"+threadId+".js") && fs.exists("scrape/comments"+threadId+".js")){
  //    console.log("skipping thread "+threadId+", already scraped")
  //    callback()
  //    return
  //  }

  page.open(url, function(){
      //console.log("plain text:") 
    //console.log(page.plainText)
    //console.log("after plain text")
   
    if(!page.plainText){
      console.log("*** error: no result for thread "+threadId)
      fs.write(scrapedir+"/posts"+threadId+".js", JSON.stringify(posts))
      fs.write(scrapedir+"/comments"+threadId+".js", JSON.stringify(comments))
      callback()
      return
    }

    fs.write(scrapedir+"/comments.json", page.plainText) 

    var threadComments = null

    try{
      threadComments = JSON.parse(page.plainText)
    }catch(e){
      console.log("error trying to parse result: "+e)
      fs.write(scrapedir+"/posts"+threadId+".js", JSON.stringify(posts))
      fs.write(scrapedir+"/comments"+threadId+".js", JSON.stringify(comments))
      callback()
      return

    }
    var numPosts = threadComments.num_posts

    var isLast = true

    threadComments.posts.forEach(function(post, i, arr){

        console.log("***")
        console.log("post "+i+": id: "+post.id+", order: "+post.order+", user_id: "+post.user_id+", post_time: "+post.post_time+", votes: "+post.votes)
        //console.log(JSON.stringify(post))
        //skip the empty posts, not sure what they are - deleted?
        if("post_text" in post){
          isLast = true
          console.log(post.post_text.substr(0,40))
          if(post.id != lastPostId){
            posts.push(post)
            lastPostId = post.id
          } else {
            console.log("skipping post "+post.id)
          }
        } else {
          isLast = false
        }

          //
      })

    threadComments.comments.forEach(function(comment, i, arr){

        console.log("***")
        console.log("comment "+i+": id: "+comment.id+", post_id: "+comment.post_id+", user_id: "+comment.user_id+", post_time: "+comment.post_time)
        //console.log(JSON.stringify())
        console.log(comment.comment_text.substr(0,40))
        comments.push(comment)
      })

   // console.log("posts retrieved: "+posts.length+", with comments: "+(posts.length+comments.length)+", num_posts: "+numPosts)
    
    if (!isLast && lastPostId) {
      console.log("*** trying to read more from the thread, after "+lastPostId)

      setTimeout(function(){
            scrapeThread(threadId, callback, posts,comments,lastPostId) 
          },2000)

    } else {
      //console.log("reached end of thread")
      fs.write(scrapedir+"/posts"+threadId+".js", JSON.stringify(posts))
      fs.write(scrapedir+"/comments"+threadId+".js", JSON.stringify(comments))
      setTimeout(callback, 5000)
    }
  })
}

function finish(){
  //console.log("field: "+pwdfield+", count: "+waitCount);
  // page.render("signin.png");
  phantom.exit()
}

dologin(function(){
    scrapeThreads(afterThreadsCollection)
  })
