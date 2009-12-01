/* -*- Mode: Javascript; -*- */

var sbooks_social_id="$Id$";
var sbooks_social_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

    Use and redistribution (especially embedding in other
      CC licensed content) is permitted under the terms of the
      Creative Commons "Attribution-NonCommercial" license:

          http://creativecommons.org/licenses/by-nc/3.0/ 

    Other uses may be allowed based on prior agreement with
      beingmeta, inc.  Inquiries can be addressed to:

       licensing@beingmeta.com

   Enjoy!

*/

/* Global variables */

// The echoes element
var sbookHUDechoes=false;
// The user/tribe bar
var sbookHUDsocial=false;

// 'Database' elements
var sbook_allechoes=[];
var sbook_echo_syncstamp=false;
var sbook_conversants=[];
var social_info={};
var sbook_echoes_by_pingid={};
var sbook_echoes_by_user={_all:[]};
var sbook_echoes_by_tag={_all:[]};
var sbook_echoes_by_xtag={};
var sbook_echoes_by_tribe={_all:[]};
var sbook_echoes_by_id={};

var sbook_echoes_target=false;
var sbook_echobar=false;
var sbook_echo_sources=false;

var sbook_echo_remark_icon=
  "http://static.beingmeta.com/graphics/remarkballoon16x13.png";
var sbook_echo_more_icon=
  "http://static.beingmeta.com/graphics/Asterisk16x16.png";
var sbook_echo_eye_icon=
  "http://static.beingmeta.com/graphics/EyeIcon20x16.png";

/* Social UI components */

function sbookAllEchoesDiv()
{
  var results_div=fdjtDiv("#SBOOKALLECHOES.sbooksummaries.hud");
  sbookShowSummaries(sbook_allechoes,results_div,false);
  sbookEchoesHUD=results_div;
  results_div.onclick=sbookSummary_onclick;
  results_div.onmouseover=sbookSummary_onmouseover;
  return results_div;
}

function sbookTestEcho(echo,sources,idroot)
{
  return
    (((sources===true) ||
      ((sources.indexOf) ? (sources.indexOf(echo.user)>=0) :
       ((sources instanceof Array) && (fdjtIndexOf(sources,echo.user)>=0))) ||
      ((sources.indexOf) && (echo.tribes) &&
       (fdjtOverlaps(echo.tribes,sources)))) &&
     ((!(idroot)) ||
      ((echo.fragid) && (echo.fragid.search(idroot)===0))));
}

function sbookSelectEchoes(results_div,sources,justlocal,idroot)
{
  if (typeof justlocal === "undefined")
    justlocal=((sources===false) || (sources.length===0));
  var blocks=$$(".tocblock",results_div);
  if (idroot)
    fdjtAddClass(results_div,"targeted");
  else fdjtDropClass(results_div,"targeted");
  var i=0; while (i<blocks.length) {
    var block=blocks[i++];  var empty=true;
    var summaries=$$(".summary",block);
    var j=0; while (j<summaries.length) {
      var summary=summaries[j++];
      var echo=summary.sbookecho;
      if (echo)
	if (((sources===true) ||
	     ((sources.indexOf) ? (sources.indexOf(echo.user)>=0)  :
	      // Handle the fact that Javascript arrays may not have indexOf
	      ((sources instanceof Array) &&
	       (fdjtIndexOf(sources,echo.user)>=0))) ||
	     ((sources.indexOf) && (echo.tribes) &&
	      (fdjtOverlaps(echo.tribes,sources)))) &&
	    ((!(idroot)) ||
	     ((echo.fragid) && (echo.fragid.search(idroot)===0)))) {
	  fdjtDropClass(summary,"hidden"); empty=false;}
	else fdjtAddClass(summary,"hidden");
      else if (justlocal) {
	fdjtDropClass(summary,"hidden"); empty=false;}
      else fdjtAddClass(summary,"hidden");}
    if (empty) fdjtAddClass(block,"hidden");
    else fdjtDropClass(block,"hidden");}
}

function sbookGetSourcesUnder(idroot)
{
  var users=[];
  var i=0; while (i<sbook_allechoes.length) {
    var echo=sbook_allechoes[i++];
    if (echo.fragid.search(idroot)===0)
      if (fdjtIndexOf(users,echo.user)<0)
	users.push(echo.user);}
  return users;
}

function sbookVectorEqual(v1,v2)
{
  if (v1.length===v2.length) {
    var i=0; while (i<v1.length)
	       if (v1[i]!==v2[i]) return false;
	       else i++;
    return true;}
  else return false;
    
}

function sbookEchoBar_onclick(evt)
{
  evt=evt||event||null;
  // if (!(sbook_user)) return;
  var target=$T(evt);
  if ($P(".sbooksummaries",target)) return;
  var echobar=$P(".echobar",target);
  var sources=((echobar) && (echobar.sbooksources))||[];
  var changed=false;
  if (!(echobar)) return; /* Warning? */
  if (target.oid) {
    if (evt.shiftKey) 
      if (fdjtIndexOf(sources,target.oid)>=0) {
	sources.splice(fdjtIndexOf(sources,target.oid),1);
	fdjtDropClass(target,"selected");}
      else {
	fdjtAddClass(target,"selected");
	sources.push(target.oid);}
    else sources=new Array(target.oid);}
  if (((sources)&&(!(echobar.sbooksources)))||
      (!(sbookVectorEqual(echobar.sbooksources,sources)))) {
    changed=true; echobar.sbooksources=sources;}
  if (sources.length===0) sources=true;
  if (!(sbook_mode)) {
    sbookSelectEchoes($("SBOOKALLECHOES"),sources);
    sbookHUDMode("echoes");}
  else if ((sbook_mode==="echoes") && (!(changed)))
    sbookHUDMode(false);
  else if (sbook_mode==="echoes")
    sbookSelectEchoes($("SBOOKALLECHOES"),sources);
  else if (sbook_mode==="browsing") 
    sbookSelectEchoes($("SBOOKSUMMARIES"),sources);
  else if ((sbook_mode==="searching")&&
	   (sbook_query)&&(sbook_query._query)&&
	   (sbook_query._query>0)) {
    sbookShowSearch(sbook_query);
    sbookSelectEchoes($("SBOOKSUMMARIES"),sources);
    sbookHUDMode("browsing");}
  else {
    sbookSelectEchoes($("SBOOKALLECHOES"),sources);
    sbookHUDMode("echoes");}
  if (sbook_focus) sbookScrollEchoes(sbook_focus);
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
}

function sbookSetSources(echobar,sources)
{
  var children=echobar.childNodes;
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (child.nodeType===1) {
      if ((fdjtIndexOf(sources,child.oid)>=0) ||
	  (fdjtOverlaps(sources,child.oid)))
	fdjtAddClass(child,"sourced");
      else fdjtDropClass(child,"sourced");}}
}

function sbookScrollEchoes(elt)
{
  if (elt.sbookloc) {
    var targetloc=elt.sbookloc;
    var allechoes=$("SBOOKALLECHOES");
    var children=allechoes.childNodes;
    /* We do this linearly because it's fast enough and simpler */
    var i=0; while (i<children.length) {
      var child=children[i++];
      if (child.nodeType===1) {
	if ((child.blocktarget) &&
	    (child.blocktarget.sbookloc>=targetloc)) {
	  if (child.scrollIntoView) child.scrollIntoView();
	  return;}}}}
}

function sbookCreateLoginButton(uri,image,title)
{
  var login_button=
    fdjtAnchor(((uri)?
		(uri+"?NEXT="+
		 encodeURIComponent("http://sbooks.net/app/read?URI="+encodeURIComponent(window.location.href))):
		"javascript:alert('sorry, not yet implemented'); return false;"),
	       fdjtImage(sbook_graphics_root+image,"button"));
  fdjtAddClass(login_button,"login");
  if (!(uri)) fdjtAddClass(login_button,"disabled");
  login_button.title=((uri)?(title):("(coming soon) "+title));
  login_button.onclick=sbookLoginButton_onclick;
  return login_button;
}

function sbookLoginButton_onclick(evt)
{
  evt=evt||event||null;
  evt.cancelBubble=true;
}

function sbookCreateEchoBar(classinfo,oids)
{
  if (!(oids)) oids=sbook_conversants;
  if (!(classinfo)) classinfo=".echobar.hudblock.hud";
  var help_button=
    fdjtImage("http://static.beingmeta.com/graphics/HelpIcon40x40.png",
	      ".button.help","?");
  var facebook_button=
    ((window.name==="iframe_canvas")&&
     (fdjtAnchor("http://apps.facebook.com/sbooksapp/",
		 fdjtImage(sbook_graphics_root+"facebook_32.png","button",
			  "fbapp"))));
  var everyone_button=
    fdjtImage("http://static.beingmeta.com/graphics/sBooksWE_2_32x32.png",
	      ".button.everyone","everyone");
  var fb_login=sbookCreateLoginButton
    ("http://sbooks.net/fb/auth",
     "facebook_32.png",
     "see comments and notes from your Facebook friends and groups");
  var ms_login=sbookCreateLoginButton
    (false,
     "myspacelogo32x32.png",
     "see comments and notes from your MySpace friends and groups");
  var li_login=sbookCreateLoginButton
    (false,
     "linkedinlogo32x32.png",
     "see comments and notes from your LinkedIn friends and groups");
  // var echobar=fdjtDiv(classinfo," ",everyone_button,fb_login,ms_login,li_login);
  var echobar=fdjtDiv(classinfo," ",everyone_button,fb_login);
  var echosources=fdjtDiv("echosources");
  var socialelts=[]; var echoelts=[];
  everyone_button.onclick=sbookEveryoneButton_onclick;
  echobar.onclick=sbookEchoBar_onclick;
  if (facebook_button) {
    facebook_button.target="_parent";
    facebook_button.onclick=fdjtCancelBubble;}
  help_button.title="help";
  help_button.onclick=sbookHelpButton_onclick;
  var allechoes=sbookAllEchoesDiv();
  fdjtPrepend(allechoes,fdjtWithId(sbookCreatePingHUD(),"SBOOKPING"));
  fdjtAppend(echobar,echosources,allechoes,help_button);
  echobar.socialelts=socialelts;
  sbook_echobar=echobar;
  sbook_echo_sources=echosources;
  sbookUpdateEchoBar();
  return echobar;
}

function sbookHelpButton_onclick(evt)
{
  evt=evt||event||null;
  sbookHUDToggle("help");
  evt.cancelBubble=true;
}

function sbookEveryoneButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="echoes") {
    sbookHUDMode(false);
    evt.cancelBubble=true;
    return;}
  echobar.sbooksources=true;
}

function sbookEchoToEntry(echo)
{
  var user=echo.user;
  var userinfo=social_info[user];
  var usrimg=fdjtImage(userinfo.pic,"userpic",userinfo.name);
  var userblock=fdjtDiv("userblock",usrimg);
  var icons=fdjtSpan("icons");
  var topics=fdjtDiv("topics");
  var extra=sbookEchoExtras(echo);
  var altpic=echo.altpic||false;
  var anchortext=
    (echo.msg)||((echo.excerpt) && ("'"+echo.excerpt+"'"))||(echo.title);
  var anchor=fdjtAnchorC("#"+echo.fragid,"msg",anchortext||"????")
  var head=fdjtDiv("head",(sbookEchoIcons(echo,extra)),anchor);
  var core=fdjtDiv("core",
		   ((echo.excerpt) && (fdjtDiv("excerpt",echo.excerpt))),
		   ((echo.tags) && (sbookEchoTags(echo.tags))));
  var excerpt=((echo.excerpt) ? fdjtDiv("excerpt",echo.excerpt) : false);
  var entry=fdjtDiv("echo",userblock,head,core,extra);
  var target=$(echo.fragid);
  entry.onmouseover=function(evt) {
    evt=evt||event||null;
    sbookPreview(target,true);};
  entry.onmouseout=function(evt) {
    evt=evt||event||null;
    fdjtScrollRestore();
    window.setTimeout("sbook_preview=false;",100);};
  anchor.onclick=function(evt) {
    evt=evt||event||null;
    $T(evt).blur(); sbookScrollTo(target);
    evt.cancelBubble=true;
    if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;}
  entry.uri=echo.uri; entry.tags=echo.tags; entry.fragid=echo.fragid;
  if (echo.tribes) entry.tribes=echo.tribes;
  entry.user=user; entry.pingid=echo.pingid;
  if (altpic) entry.pic=altpic;
  if (echo.nopodspot) entry.nopodspot=true;
  return entry;
}

function sbookEchoIcons(echo,extra)
{
  var eye=fdjtImage(sbook_echo_eye_icon,"eye","(\u00b7)",
		    "previewing: move mouse to restore");
  var comment=fdjtImage(sbook_echo_remark_icon,".button.relayb","+");
  var showmore=((extra) &&
		fdjtImage(sbook_echo_more_icon,".button.extrab","*"));
  var age=fdjtAnchorC("http://echoes.sbooks.net/ref/"+echo.pingid,
		      "age",fdjtIntervalString(fdjtTick()-echo.tstamp)," ago");
  age.target="_blank";
  var targetid=echo.fragid; var target=$(targetid);
  if (!(target)) eye=false;
  else {
    eye.title=_("previewing: move mouse to restore");
    eye.onclick=function(evt){
      evt=evt||event||null;
      if (document.body.preview) clearTimeout(document.body.preview);
      sbookStopPreview(target); sbookScrollTo(target);
      if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
      evt.cancelBubble=true;
      sbookSetHUD(false);};
    eye.onmouseover=function(evt){
      evt=evt||event||null;
      fdjtDelayHandler(300,sbookSetPreview,true,document.body,"preview");};
    eye.onmouseout=function(evt){
      evt=evt||event||null;
      fdjtDelayHandler(300,sbookSetPreview,false,document.body,"preview");};}
  comment.title=_("Add your own response");
  comment.onclick=function(evt){
    evt=evt||event||null;
    // fdjtTrace("Starting a relay of %o (%o)",echo,echo.msg);
    sbookSetHUD(false);
    add_podspot(target,true);
    $("SBOOKPINGRELAY").value=echo;
    $("SBOOKPINGINPUT").value=echo.msg;}; 
  showmore.title=_("See more information");
  showmore.onclick=function(evt){
    evt=evt||event||null;
    fdjtToggleClass($P('.echo',$T(evt)),'extras','shown',true);}; 
  return fdjtSpan("icons",age,showmore,comment,eye);
}

function sbookEchoTags(tags)
{
  var topics=fdjtDiv("topics");
  if (typeof tags === "string") tags=new Array(tags);
  var i=0; while (i<tags.length) {
    if (i>0)
      fdjtAppend(topics,"\u00b7",knoDTermSpan(tags[i++]));
    else fdjtAppend(topics,knoDTermSpan(tags[i++]));}
  return topics;
}

function sbookEchoExtras(echo)
{
  var detail=false; var xrefs=false;
  if (echo.detail) detail=fdjtDiv("detail",echo.detail);
  if (echo.xrefs) {
    var uris=echo.xrefs; xrefs=[];
    var i=0; while (i<uris.length) 
	       xrefs.push(fdjtAnchor(uris[i++],"xref"));}
  if ((detail) || (xrefs))
    return fdjtDiv("extras",detail,xrefs);
  else return false;
}

/* The Echoes/Social Database */

function sbookImportEchoes(data)
{
  if (!(data))
    if (typeof sbook_echoes_data === "undefined") {
      fdjtLog("No social data available");
      return;}
    else data=sbook_echoes_data;
  var date=data['%date'];
  var info=data['%info'];
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++];
      if (!(social_info[item.oid]))
	fdjtInsert(sbook_conversants,item.oid);
      social_info[item.oid]=item;}}
  var ids=data['%ids'];
  if (sbook_trace_network)
    fdjtLog("Importing echo data %o for %d ids: %o",data,ids.length,ids);
  if ((ids) && (ids.length)) {
    var i=0; while (i<ids.length) {
      var id=ids[i++];
      var element=$(id);
      // Skip references to IDs which don't exist
      if (!(element)) continue;
      var entries=data[id];
      var need_podspot=false;
      var j=0; while (j<entries.length) {
	var entry=entries[j++];
	var echo=sbook_add_echo(id,entry);
	if (!(entry.nopodspot)) need_podspot=true;
	if (element.sbookloc) echo.location=element.sbookloc;}
      if (need_podspot) add_podspot(element);}}
  sbook_allechoes.sort(function(x,y) {
      if ((x.fragid)<(y.fragid)) return -1;
      else if ((x.fragid)==(y.fragid))
	if ((x.tstamp)<(y.tstamp)) return -1;
	else if ((x.tstamp)===(y.tstamp)) return 0;
	else return 1;
      else return 1;});
  if (sbook_echobar) sbookUpdateEchoBar();
}

function sbookUpdateEchoBar()
{
  var oids=sbook_echobar._sbook_conversants; var newoids=new Array();
  if (!(oids)) {
    oids=[]; sbook_echobar._sbook_conversants=oids;}
  var users=sbook_echoes_by_user._all;
  var tribes=sbook_echoes_by_tribe._all;
  var i=0; while (i<users.length) {
    var user=users[i++];
    if ((social_info[user]) && (fdjtIndexOf(oids,user)<0)) {
      oids.push(user); newoids.push(user);}}
  i=0; while (i<tribes.length) {
    var tribe=tribes[i++];
    if ((social_info[tribe]) && (fdjtIndexOf(oids,tribe)<0)) {
      oids.push(tribe); newoids.push(tribe);}}
  var i=0; while (i<newoids.length) {
    var oid=newoids[i++]; var info=social_info[oid];
    var img=fdjtImage(info.pic,"social",info.name);
    img.oid=oid; img.name=info.name;
    if (info.summary) img.title=info.summary;
    else img.title=info.name;
    fdjtAppend(sbook_echo_sources,img);}
}

function sbookImportSocialInfo(info)
{
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++];
      social_info[item.oid]=item;}}
}

function sbook_add_echo(id,entry)
{
  var pingid=entry.pingid;
  var user=entry.user;
  var item=sbook_echoes_by_pingid[pingid];
  if (!(item)) {
    sbook_allechoes.push(entry);
    sbook_echoes_by_pingid[pingid]=entry;
    item=entry;}
  item._fdjtid=8000000+pingid;
  item.fragid=id;
  fdjtAdd(sbook_echoes_by_id,id,item);
  if (entry.taginfo) {
    var tags=entry.taginfo;
    var k=0; while (k<tags.length) {
      var tag=tags[k++];
      sbookAddTag(item,tag,true,false,true,false);}}
  else item.tags=[];
  if (entry.tribes) {
    var tribes=entry.tribes;
    var k=0; while (k<tribes.length) {
      var tribe=tribes[k++];
      if (item!=entry) fdjtAdd(item,'tribes',tribe,true);
      fdjtAdd(sbook_echoes_by_tribe,tribe,item);}}
  else item.tribes=[];
  if (entry.user) {
    if (item!=entry) item.user=user;
    fdjtAdd(sbook_echoes_by_user,user,item);}
  var tstamp=entry.tstamp;
  if (tstamp>sbook_echo_syncstamp) sbook_echo_syncstamp=tstamp;
  if ((entry.xrefs) && (item!=entry)) item.xrefs=entry.xrefs;
  if ((entry.uri) && (item!=entry)) item.uri=entry.uri;
  if ((entry.msg) && (item!=entry)) item.msg=entry.msg;
  if ((entry.excerpt) && (item!=entry)) item.excerpt=entry.excerpt;
  if ($("SBOOKALLECHOES")) {
    var allechoes_div=$("SBOOKALLECHOES");
    sbookAddSummary(item,$("SBOOKALLECHOES"),false);}
  return item;
}

function sbookGetEchoesUnder(id)
{
  var results=[];
  var i=0; while (i<sbook_allechoes.length) {
    var echo=sbook_allechoes[i++];
    var fragid=echo.fragid;
    if (fragid.search(id)===0) results.push(echo);}
  // fdjtTrace("Got %d echoes under %s",results.length,id);
  return results;
}

function createSBOOKHUDping()
{
  var wrapper=fdjtDiv("#SBOOKPING.sbookping.hudblock.hud");
  var iframe=fdjtNewElement("iframe","#SBOOKPINGFRAME");
  iframe.src="";
  iframe.hspace=0; iframe.vspace=0;
  iframe.marginHeight=0; iframe.marginWidth=0;
  iframe.border=0; iframe.frameBorder=0;
  fdjtAppend(wrapper,iframe);
  wrapper.onfocus=function (evt){
    iframe.src=
    sbook_podspot_uri(sbook_refuri,
		      sbook_head.id,
		      sbook_head.title||document.title||"",
		      false);};
  return wrapper
}

function gather_tags(elt,results)
{
  if (!(results)) results=[];
  var tags=elt.tags;
  if ((tags) && (tags.length>0)) {
    var i=0; while (i<tags.length) results.push(tags[i++]);}
  // don't do this for now
  // if (elt.parentNode) gather_tags(elt.parentNode,results);
  if (elt.sbook_head) {
    var head=elt.sbook_head; var htags=head.tags;
    if ((htags) && (htags.length>0)) {
      var i=0; while (i<htags.length) results.push(htags[i++]);}}
  return results;
}

function gather_tribes(elt,results)
{
  if (!(results)) results=[];
  var tribes=fdjtCacheAttrib(elt,"tribes",fdjtSemiSplit,[]);
  if ((tribes) && (tribes.length>0)) {
    var i=0; while (i<tribes.length) results.push(tribes[i++]);}
  if (elt.parentNode) gather_tribes(elt.parentNode,results);
  if (elt.sbook_head) {
    var head=elt.sbook_head;
    var htribes=fdjtCacheAttrib(head,"tribes",fdjtSemiSplit,[]);
    if ((htribes) && (htribes.length>0)) {
      var i=0; while (i<htribes.length) results.push(htribes[i++]);}}
  return results;
}

/* Displaying podspots */

function add_podspot(target,open)
{
  if (target.podspot) return target.pospot;
  var id=target.id;
  var title=target.getAttribute('title');
  var tribes=target.getAttribute('tribes')||[];
  var tags=gather_tags(target);
  var sources=sbookGetSourcesUnder(id);
  var imgsrc=sbook_graphics_root+"sBooksWE_2_32x32.png";
  var pingimgsrc=sbook_graphics_root+"remarkballoon32x32.png";
  if ((sources.length===1) &&
      (social_info[sources[0]].pic))
    imgsrc=social_info[sources[0]].pic||imgsrc;
  var podspot=fdjtSpan("podspot",fdjtImage(imgsrc,"podimg","comments"));
  podspot.onclick=function(evt){
    evt=evt||event||null;
    if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
    evt.cancelBubble=true;
    if ((sbook_mode==="echoes") &&
	(sbook_echoes_target===target)) {
      sbookHUDMode(false); return;}
    sbook_echoes_target=target;
    if (evt.shiftKey)
      sbookSelectEchoes(sbookEchoesHUD,$("SBOOKECHOES").sbooksources,false,id);
    else sbookSelectEchoes(sbookEchoesHUD,true,false,id);
    sbookHUDMode("echoes");};
  podspot.onmouseover=function(evt){
    evt=evt||event||null;
    fdjtAddClass(target,"sbooklivespot");};
  podspot.onmouseout=function(evt){
    evt=evt||event||null;
    fdjtDropClass(target,"sbooklivespot");};
  target.podspot=podspot;
  if (sbook_podspot_qricons) {
    var qrhref="http://echoes.sbooks.net/echoes/qricon.fdcgi?"+
      "URI="+encodeURIComponent(sbook_refuri)+
      ((id)?("&FRAG="+id):"")+
      ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
    var i=0; while (i<tribes.length) qrhref=qrhref+"&TRIBES="+tribes[i++];
    i=0; while (i<tags.length) qrhref=qrhref+"&TAGCUE="+tags[i++];
    fdjtPrepend(target,fdjtImage(qrhref,"sbookqricon"));}
  fdjtPrepend(target,podspot);
  return podspot;
}

function sbook_get_titlepath(info,embedded)
{
  if (!(info))
    if (document.title)
      if (embedded)
	return " // "+document.title;
      else return "";
    else return "";
  else {
    var next=(info.sbook_head)||false;
    if (info.title)
      return ((embedded) ? (" // ") : (""))+info.title+
	sbook_get_titlepath(next,true);
    else return sbook_get_titlepath(next,embedded);}
}

/* Searching echoes */

function sbook_search_echoes(query)
{
  var i=0; var results=false;
  while (i<query.length) {
    var q=query[i++];
    var echoes=sbook_echoes_by_tag[q]||(false);
    if (echoes)
      if (results)
	results=fdjtIntersect(results,echoes);
      else results=echoes;
    else {}}
  return results||[];
}

function sbook_ping(target,echo)
{
  if (sbook_target!==target) {
    $("SBOOKPINGFORM").reset();
    sbookPingHUDSetup(target);}
  if (echo)
    if (echo.user===sbook_user)
      sbookPingHUDSetup(echo);
    else {
      if (echo.echo) $("SBOOKPINGRELAY").value=echo.echo;
      if (echo.user) {
	var userinfo=social_info[echo.user];
	var echoblock=
	  fdjtDiv("sbookrelayblock","Relayed from ",
		  fdjtSpan("user",userinfo.name),
		  ((echo.msg)&&(": ")),
		  ((echo.msg)?(fdjtSpan("msg",echo.msg)):(false)));
	fdjtReplace("SBOOKPINGRELAYBLOCK",echoblock);}}
  sbookHUDMode("ping");
  $("SBOOKPINGINPUT").focus();
}

function sbook_open_ping()
{
  var iframe; var focus=sbook_focus;
  if ((focus) && (focus.podspot) &&
      (focus.podspot.iframe))
    iframe=sbook_focus.podspot.iframe;
  else if ((focus) && (focus.podspot))
    iframe=focus.podspot.openIFrame();
  else {
    var podspot=add_podspot(focus,true);
    focus.podspot=podspot;
    iframe=podspot.iframe;};
  return iframe;
}

/* Invoking the iframe */

var sbook_echo_head=false;
var sbook_tribes=false;
function sbook_podspot_uri(uri,hash,title,tribes,tags)
{
  var hashpos=uri.indexOf('#');
  // fdjtTrace("Getting podspot for %s",uri);
  if ((hash) && (hashpos>=0))
    uri=uri.slice(0,hashpos)+'#'+hash;
  else if (hash) uri=uri+'#'+hash;
  var href=sbook_webechoes_root+"qricon.fdcgi?"+
    "IFRAME=yes&PODSPOT=yes&DIALOG=yes";
  if (uri) href=href+"&URI="+encodeURIComponent(uri);
  if (title) href=href+"&TITLE="+encodeURIComponent(title);
  if (tribes) {
    if ((typeof tribes === "string") && (tribes.indexOf(';')>0))
      tribes=tribes.split(';');
    if (typeof tribes === "string")
      href=href+"&TRIBES="+encodeURIComponent(tribes);
    else if ((typeof tribes === "object") && (tribes instanceof Array)) {
      var i=0; while (i<tribes.length) 
		 href=href+"&TRIBES="+encodeURIComponent(tribes[i++]);}
    else fdjtWarn("Weird TRIBES argument for podspot %o",tribes);}
  if (tags) {
    var i=0; while (i<tags.length) href=href+"&TAG="+tags[i++];}
  return href;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
