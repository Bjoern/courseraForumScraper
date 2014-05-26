/**
 *  creates threadsbycomments.csv and starters.csv
 */
var fs = require('fs')

var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] 

var config = JSON.parse(fs.readFileSync("config.json", {encoding: "UTF-8"}))

var scrapedir = config.scrapedir
var statsdir = config.statsdir

var threadsJSON = fs.readFileSync(scrapedir+"/threads.json", {encoding: "UTF-8"})

var threads = JSON.parse(threadsJSON)

console.log("threads found: "+threads.length)

var dataRows = []
var starters = {}
var starterRows = []

threads.forEach(function(thread, index, arr){
    processThread(thread)
  })

//processThread(2079)
var columns = ["day of week","date","title","comments","ctacomments","staffcomments","upvotes","downvotes","views","starter"]

dataRows.sort(function(a,b){
  return b.comments - a.comments
})

writeCSV("threadsbycomments.csv",columns, dataRows);
//console.log("columns: "+columns.join(";"))

for(key in starters){
  starterRows.push({name:key,started:starters[key]})
}

starterRows.sort(function(a,b){
  return b.started - a.started
  })

writeCSV("starters.csv",["name","started"],starterRows)

function writeCSV(filename, columns, dataRows){
  var rows = dataRows.map(function(r){
      return columns.map(function(c){
          return escapeCSV(r[c])
        }).join(";")
    })

  //write title bar
  rows.unshift(columns.join(";"))

  fs.writeFileSync(statsdir+"/"+filename, rows.join("\n"))
}

function escapeCSV(data){
  if("string" == typeof data){
    return '"'+data.replace(/"/g,'""')+'"'
  } else {
    return data
  }
}

function processThread(thread){
  //console.log("process thread "+thread.id)
  var threadId = thread.id

  var date = new Date(thread.posted_time*1000)

  var name = thread._starter.full_name

  if(!name){
    name = "anonymous"
  }

  starters[name] = (starters[name] || 0)+1

  var postsJSON = fs.readFileSync(scrapedir+"/posts"+threadId+".js", {encoding: "UTF-8"})
  var commentsJSON = fs.readFileSync(scrapedir+"/comments"+threadId+".js", {encoding: "UTF-8"})

  //console.log("postsJSON: "+postsJSON)

  var posts = JSON.parse(postsJSON)
  var comments = JSON.parse(commentsJSON)

  var stats =  {ctacomments:0,staffcomments:0,upvotes:0,downvotes:0}

  processPosts(posts, stats, "posts")
  //console.log("post stats after return: "+JSON.stringify(stats))
  processPosts(comments, stats, "comments")
  //console.log("comments stats after return: "+JSON.stringify(stats))

  dataRows.push({
      "day of week":dayNames[date.getUTCDay()],
    date:keyString(date),
    title:thread.title,
    comments:thread.num_posts,
    ctacomments:stats.ctacomments,
    staffcomments:stats.staffcomments,
    upvotes:stats.upvotes,
    downvotes:stats.downvotes,
    views:thread.num_views,
    starter:thread._starter.full_name
    })
}

function processPosts(posts, stats, label){
  //console.log(label+" stats before: "+JSON.stringify(stats))

  posts.reduce(function(stats, post){
      if(post._user_title === "Community TA"){
        stats.ctacomments++
        } else if(post._user_title === "Staff"){
          stats.staffcomments++
          }

        if(post.votes > 0){
          stats.upvotes += post.votes
        } else if(post.votes < 0){
          stats.downvotes += post.votes
        }
        return stats
      }, stats)

  //console.log(label+" stats after: "+JSON.stringify(stats))


  }

function keyString(date){
  return date.getUTCFullYear()+"-"+(1+date.getUTCMonth())+"-"+date.getUTCDate()
}