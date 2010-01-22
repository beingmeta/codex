/* -*- Mode: Javascript; -*- */

var sbooks_social_id="$Id: social.js 4605 2009-12-10 15:37:28Z haase $";
var sbooks_social_version=parseInt("$Revision: 4605 $".slice(10,-1));

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

var sbook_sources=false;
var sbook_glosses_target=false;
var sbookGlossesHUD=false;
var sbookFeedHUD=false;

// The highlighted glossmark
var sbook_glossmark=false;

var sbook_gloss_remark_icon=
  "http://static.beingmeta.com/graphics/remarkballoon16x13.png";
var sbook_gloss_more_icon=
  "http://static.beingmeta.com/graphics/Asterisk16x16.png";
var sbook_gloss_eye_icon=
  "http://static.beingmeta.com/graphics/EyeIcon20x16.png";

// The glosses element
var sbookHUDglosses=false;
// The user/tribe bar
var sbookHUDsocial=false;

/* Social UI components */

function sbookCreateGlossesHUD(classinfo)
{
  if (sbookGlossesHUD) return sbookGlossesHUD;
  sbookGlossesHUD=
    fdjtDiv(classinfo||"#SBOOKGLOSSES.sbooksummaries.hudblock.hud",
	    sbookCreateMarkHUD("#SBOOKMARK"));
  sbookShowSummaries(sbook_allglosses,sbookGlossesHUD,false);
  sbookGlossesHUD.onclick=sbookSummary_onclick;
  sbookGlossesHUD.onmouseover=sbookSummary_onmouseover;
  return sbookGlossesHUD;
}

function sbookCreateFeedHUD(classinfo,feeds)
{
  if (sbookFeedHUD) return sbookFeedHUD;
  if (!(feeds)) feeds=sbook_conversants;
  if (!(classinfo)) classinfo=".feeds.hudblock.hud#SBOOKFEEDS";
  var app_button=
    fdjtImage("http://static.beingmeta.com/graphics/sbookslogo40x40.png",
	      ".button.app","?","app");
  var login_button=
    fdjtImage("http://static.beingmeta.com/graphics/sbookslogo40x40.png",
	      ".button.login","?","login");
  var everyone_button=
    fdjtImage("http://static.beingmeta.com/graphics/sBooksWE_2_32x32.png",
	      ".button.everyone","everyone");
  var feedicons=fdjtDiv("#SBOOKFEEDICONS.feedicons");
  var socialelts=[]; var glosselts=[];
  everyone_button.onclick=sbookEveryoneButton_onclick;
  login_button.onclick=sbookLoginButton_onclick;
  feedicons.onclick=sbookFeeds_onclick;
  app_button.onclick=sbookAppButton_onclick;
  var i=0; var n=feeds.length;
  while (i<n) sbookAddFeedIcon(fdjtOIDs[feeds[i++]]);
  sbookFeedHUD=fdjtDiv(classinfo," ",
		       login_button,app_button,
		       feedicons,everyone_button);
  return sbookFeedHUD;
}

function sbookAddFeedIcon(info)
{
  var humid=info.humid;
  var icon=$("SBOOKFEEDICON"+humid);
  if (icon) return icon;
  else icon=fdjtImage(info.pic,".button.feed",info.name,"click to see glosses");
  icon.oid=info.oid; icon.id="SBOOKFEEDICON"+humid;
  fdjtAppend("SBOOKFEEDICONS"," ",icon);
  return icon;
}

function sbookEveryoneButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_sources) {
    var feeds=$$(".feed",sbookFeedHUD);
    var i=0; var n=feeds.length;
    while (i<n) fdjtDropClass(feeds[i++],"selected");
    sbook_sources=false;
    if (sbook_mode==="glosses") 
      sbookSelectSummaries($("SBOOKGLOSSES"));
    else if ((sbook_mode==="searching")||(sbook_mode==="browsing"))
      sbookSelectSummaries($("SBOOKSUMMARIES"));
    else sbookHUDMode("glosses");}
  else if (sbook_mode==='glosses') sbookHUDMode(false);
  else sbookHUDMode("glosses");
  fdjtDropClass(sbookHUD,"targeted");
  evt.cancelBubble=true;
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;  
}

function sbookFeeds_onclick(evt)
{
  evt=evt||event||null;
  // if (!(sbook_user)) return;
  var target=$T(evt);
  var feeds=$P(".feedicons",target);
  if (!(feeds)) return; /* Warning? */
  if (!(target.oid)) return;
  var info=fdjtOIDs[target.oid];
  var icon=$("SBOOKFEEDICON"+info.humid);
  if ((icon)&&(fdjtHasClass(icon,"selected"))&&
      (sbook_sources.length===1)) {
    // If you're clicking a selected icon and there's only one,
    //  then just toggle the HUD off
    fdjtDropClass(icon,"selected");
    sbook_sources=[];
    evt.cancelBubble=true;
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue=false;
    if (sbook_mode==='glosses')
      sbookSelectSummaries($("SBOOKGLOSSES"),false);
    else if ((sbook_mode==='searching')||(sbook_mode==='browsing'))
      sbookSelectSummaries($("SBOOKSUMMARIES"),false);
    sbookHUDMode(false);
    return false;}
  else if (!(sbook_sources)) {
    fdjtAddClass(icon,"selected");
    sbook_sources=new Array(target.oid);}
  else if ((evt.shiftKey)||(evt.ctrlKey))
    if (fdjtContains(sbook_sources,target.oid)) {
      fdjtDropClass(icon,"selected");
      fdjtRemove(sbook_sources,target.oid);}
    else {
      fdjtAddClass(icon,"selected");
      sbook_sources.push(target.oid);}
  else {
    if (sbook_sources) {
      var feedicons=$$(".feed",feeds);
      var i=0; var len=feedicons.length;
      while (i<len) fdjtDropClass(feedicons[i++],"selected");}
    fdjtAddClass(icon,"selected");
    sbook_sources=new Array(target.oid);}
  if ((sbook_sources) && (sbook_sources.length===0)) sources=false;
  if (!(sbook_mode)) {
    sbookSelectSummaries($("SBOOKGLOSSES"),sbook_sources);
    sbookHUDMode("glosses");}
  else if (sbook_mode==="glosses")
    sbookSelectSummaries($("SBOOKGLOSSES"),sbook_sources);
  else if (sbook_mode==="browsing") 
    sbookSelectSummaries($("SBOOKSUMMARIES"),sbook_sources);
  else if ((sbook_mode==="searching")&&
	   (sbook_query)&&(sbook_query._query)&&
	   (sbook_query._query>0)) {
    sbookShowSearch(sbook_query);
    sbookSelectSummaries($("SBOOKSUMMARIES"),sbook_sources);
    sbookHUDMode("browsing");}
  else {
    sbookSelectSummaries($("SBOOKGLOSSES"),sbook_sources);
    sbookHUDMode("glosses");}
  fdjtDropClass(sbookHUD,"targeted");
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
}

function sbookSetSources(feeds,sources)
{
  var children=feeds.childNodes;
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (child.nodeType===1) {
      if ((fdjtIndexOf(sources,child.oid)>=0) ||
	  (fdjtOverlaps(sources,child.oid)))
	fdjtAddClass(child,"sourced");
      else fdjtDropClass(child,"sourced");}}
}

function sbookScrollGlosses(elt,glosses)
{
  if (elt.sbookloc) {
    var targetloc=elt.sbookloc;
    if (!(glosses)) glosses=$("SBOOKGLOSSES");
    var children=glosses.childNodes;
    /* We do this linearly because it's fast enough and simpler */
    var i=0; while (i<children.length) {
      var child=children[i++];
      if (child.nodeType===1) {
	if ((child.blocktarget) &&
	    (!(fdjtHasClass(child,"hidden"))) &&
	    (child.blocktarget.sbookloc>=targetloc)) {
	  fdjtScrollIntoView(child);
	  return;}}}}
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

/* Displaying glossmarks */

function sbookGlossmark(target,open)
{
  if ((target)&&(target.glossmarkid))
    return $(target.glossmarkid);
  var id=((target)&&(target.id));
  var title=((target)&&(target.getAttribute('title')));
  var tags=((target)?(gather_tags(target)):[]);
  var sources=((id)?(sbookGetSourcesUnder(id)):[]);
  var imgsrc=((target)?(sbook_graphics_root+"sBooksWE_2_32x32.png"):
	      (sbook_graphics_root+"remarkballoon32x32.png"));
  // By default the glossmark image is the user when unique
  if (sources.length===1) imgsrc=(fdjtOIDs[sources[0]].pic)||imgsrc;
  var glossmark=fdjtSpan
    ("glossmark",fdjtImage(imgsrc,"podimg","comments"));
  glossmark.onclick=sbookGlossmark_onclick;
  glossmark.onmouseover=sbookGlossmark_onmouseover;
  glossmark.onmouseout=sbookGlossmark_onmouseout;
  if (id) {
    target.glossmarkid=glossmark.id="SBOOK_GLOSSMARK_"+id;
    glossmark.sbook_ref=id;}
  if ((target)&&(sbook_glossmark_qricons)) {
    var qrhref="http://glosses.sbooks.net/glosses/qricon.fdcgi?"+
      "URI="+encodeURIComponent(sbook_refuri)+
      ((id)?("&FRAG="+id):"")+
      ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
    var i=0; while (i<tags.length) qrhref=qrhref+"&TAGCUE="+tags[i++];
    fdjtPrepend(target,fdjtImage(qrhref,"sbookqricon"));}
  if (target) {
    fdjtAddClass(target,"glossed");
    fdjtPrepend(target,glossmark);}
  return glossmark;
}

function sbookGlossmark_onclick(evt)
{
  evt=evt||event||null;
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
  var target=sbookGetRef(evt.target)||sbookGetFocus(evt.target.parentNode);
  if ((sbook_mode==="glosses") &&
      (sbook_glosses_target===target)) {
    fdjtCancelEvent(evt);
    sbookHUDMode(false);
    return;}
  sbook_glosses_target=target;
  if ((evt.shiftKey)||(evt.ctrlKey))
    sbookSelectSummaries(sbookGlossesHUD,sbook_sources,target.id);
  else sbookSelectSummaries(sbookGlossesHUD,false,target.id);
  fdjtAddClass(sbookHUD,"targeted");
  sbookSetTarget(target);
  sbook_glossmark=$P(".glossmark",evt.target);
  sbookMarkHUDSetup(target);
  sbookHUDMode("glosses");
  fdjtSetScroll(false,75,sbook_glossmark);
  fdjtCancelEvent(evt);
}

function sbookGlossmark_onmouseover(evt)
{
  evt=evt||event||null;
  var target=sbookGetRef(evt.target)||sbookGetFocus(evt.target);
  fdjtAddClass(target,"sbooklivespot");
}

function sbookGlossmark_onmouseout(evt)
{
  evt=evt||event||null;
  var target=sbookGetRef(evt.target)||sbookGetFocus(evt.target);
  fdjtDropClass(target,"sbooklivespot");
}

function createSBOOKHUDping()
{
  var wrapper=fdjtDiv("#SBOOKMARK.sbookping.hudblock.hud");
  var iframe=fdjtNewElement("iframe","#SBOOKMARKFRAME");
  iframe.src="";
  iframe.hspace=0; iframe.vspace=0;
  iframe.marginHeight=0; iframe.marginWidth=0;
  iframe.border=0; iframe.frameBorder=0;
  fdjtAppend(wrapper,iframe);
  wrapper.onfocus=function (evt){
    iframe.src=
    sbook_glossmark_uri(sbook_refuri,
		      sbook_head.id,
		      sbook_head.title||document.title||"",
		      false);};
  return wrapper;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
