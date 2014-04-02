var fs = require('fs')

var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] 
var configstr = fs.readFileSync("config.json", {encoding: "utf8"})
var config = JSON.parse(configstr)

var watchNames = config.users
var scrapedir = config.scrapedir
var statsdir = config.statsdir

var threadsJSON = fs.readFileSync(scrapedir+"/threads.json", {encoding: "UTF-8"})

var threads = JSON.parse(threadsJSON)

console.log("threads found: "+threads.length)

var commentsPerDay = {}

var ctaComments = {}

var users = {}
var userStats = []

//used in debugging
var textCheck = {}

threads.forEach(function(thread, index, arr){
    processThread(thread.id)
  })

//processThread(2079)

var dataRows = []

for(key in commentsPerDay){
  dataRows.push(commentsPerDay[key])
}

dataRows.sort(function(a,b){
    //console.log(a.day.getUTCFullYear()+"-"+a.day.getUTCMonth()+"-"+a.day.getUTCDate() +" vs "+b.day.getUTCFullYear()+"-"+b.day.getUTCMonth()+"-"+b.day.getUTCDate())
    var result = Date.UTC(a.day.getUTCFullYear(), a.day.getUTCMonth(), a.day.getUTCDate()) 
      - Date.UTC(b.day.getUTCFullYear(), b.day.getUTCMonth(), b.day.getUTCDate())
    //console.log("result: "+result)

    return  result
  })

//update unique users

var knownNames = {}

dataRows.forEach(function(entry,index,arr){
  for(name in entry.usersToday){
    if(!knownNames[name]){
      knownNames[name] = true
      entry.newUsers++;
      if("Tue 2014-3-4" === entry.date){
       // console.log(entry.date+", new overall: "+name)
      }

    }
  }
  })

var columns = ["date","ctacomments","staffcomments","comments", "words", "ctawords", "staffwords", "newUsers", "uniqueUsers"]
columns.push.apply(columns,watchNames)

watchNames.forEach(function(name){
  columns.push("words "+name)
  })

var voteColumns = ["date","down4plus","down3","down2","down1","up0","up1","up2","up3","up4plus","totalVotes"]
var userColumns = ["user", "comments", "words", "upvoted posts", "downvoted posts", "upvotes", "downvotes"]

writeCSV("postsperday.csv",columns, dataRows);
writeCSV("postsbyvotes.csv",voteColumns, dataRows)
//console.log("columns: "+columns.join(";"))

function writeCSV(filename, columns, dataRows){
  var rows = dataRows.map(function(r){
      return columns.map(function(c){
          return r[c]
        }).join(";")
    })

  //write title bar
  rows.unshift(columns.join(";"))

  fs.writeFileSync(statsdir+"/"+filename, rows.join("\n"))
}

var ctaStats = []

for(key in ctaComments){
  ctaStats.push({user: key, comments: ctaComments[key]})
}

ctaStats.sort(function(a,b){
  return b.comments - a.comments
  })

fs.writeFileSync(statsdir+"/ctastats.csv", ctaStats.map(function(cta){
      return cta.user+";"+cta.comments
    }).join("\n"))


for(key in users){
  userStats.push(users[key])
}

userStats.sort(function(a,b){
  return b.comments - a.comments 
  })

console.log("total different users: "+userStats.length)

writeCSV("userstats.csv", userColumns, userStats)

function processThread(threadId){
  //console.log("process thread "+thread.id)

  var postsJSON = fs.readFileSync(scrapedir+"/posts"+threadId+".js", {encoding: "UTF-8"})
  var commentsJSON = fs.readFileSync(scrapedir+"/comments"+threadId+".js", {encoding: "UTF-8"})

  //console.log("postsJSON: "+postsJSON)

  var posts = JSON.parse(postsJSON)
  var comments = JSON.parse(commentsJSON)

  posts.forEach(processPost)

  comments.forEach(processPost)

}

function processPost(post){

      var date = new Date(post.post_time*1000)

      var dayKey = keyString(date)

      //console.log(dayKey)

      if(!commentsPerDay[dayKey]){
        commentsPerDay[dayKey] = {
          day:date,
          date:dayKey,
          comments:0,
          words:0,
          ctacomments:0,
          ctawords:0,
          staffcomments:0,
          staffwords:0,
          up0:0,
          up1:0,
          up2:0,
          up3:0,
          up4plus:0,
          down1:0,
          down2:0,
          down3:0,
          down4plus:0,
          totalVotes:0,
          uniqueUsers:0,
          newUsers:0,
          usersToday:{}
        }
        watchNames.forEach(function(name){
            commentsPerDay[dayKey][name] = 0
            commentsPerDay[dayKey]["words "+name] = 0 
          })
      }

      var entry = commentsPerDay[dayKey]

      var name = post._user_full_name

      if(!post._user_full_name){
        name = "anonymous"
        if(!post.anonymous){
          console.log("anon: "+post.anonymous+", name: "+post._user_full_name+" given: "+name)
        }
      }

      if(!entry.usersToday[name]){
        entry.uniqueUsers++;
        entry.usersToday[name] = true
        if("Tue 2014-3-4" === dayKey){
          //console.log(dayKey+", new today: "+name)
        }
      }

      var text = post.post_text || post.comment_text

      var words = wordCount(text)

      var votes = post.votes

      if(!users[name]){
        users[name] = {user:name, comments: 0, words: 0, "upvoted posts":0, "downvoted posts":0, upvotes:0, downvotes:0} 
        
      }

      users[name].comments++;

      //checking for duplicates while debugging
      if(false && name === "some name"){
        console.log(users[name].comments+", votes: "+post.votes+", some name "+(text || "unknown").substring(0,60))
        if(!text){
          //console.log(JSON.stringify(post))
        } else {
          var textKey = text.substring(0,20)
          if(false && textCheck[textKey]){
            console.log("**** error: duplicate text **** ")
            console.log(JSON.stringify(post))
            console.log("*** first appearance: ")
            console.log(JSON.stringify(textCheck[textKey]))
          } else {
            textCheck[textKey] = post 
          }
        }
      }

      users[name].words += words
      if(votes > 0){
        users[name]["upvoted posts"]++;
        users[name].upvotes += votes
      } else if(votes < 0){
        users[name]["downvoted posts"]++;
        users[name].downvotes += votes
      }

      entry.totalVotes += votes

      if(votes >= 4){
        entry.up4plus++;
      } else if(votes === 3){
        entry.up3++;
      }else if(votes === 2){
        entry.up2++;
      }
      else if(votes === 1){
        entry.up1++;
      }
      else if(votes === 0){
        entry.up0++;
      }
      else if(votes === -1){
        entry.down1++;

      }
      else if(votes === -2){
        entry.down2++;

      }
      else if(votes === -3){
        entry.down3++;

      }
      else if(votes <= 4){
        entry.down4plus++;
      }

      if(post._user_title === "Community TA"){
        entry.ctacomments++
        entry.ctawords += words
        ctaComments[name] = (ctaComments[name] || 0)+1
    } else if(post._user_title === "Staff"){
      //console.log("post by staff :" +name);
      entry.staffcomments++;
      ctaComments[name] = (ctaComments[name] || 0)+1
      entry.staffwords += words
    } else {
        if(watchNames.find(function(n){return n === name})){
          entry[name] = (entry[name] || 0) + 1
          entry["words "+name] = (entry["words "+name] || 0) + words
        } else {
          entry.comments++
          entry.words += words
        }
      }

}

function keyString(date){
  return dayNames[date.getUTCDay()]+" "+date.getUTCFullYear()+"-"+(1+date.getUTCMonth())+"-"+date.getUTCDate()
}

function wordCount(text){
  if(!text){
    return 0
  }

  var words = text.split(/\s+/g)

  return words.length
}