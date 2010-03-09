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

var sbook_sources=false;
var sbook_glosses_target=false;
var sbookGlossesHUD=false;
var sbookSourceHUD=false;

// The highlighted glossmark
var sbook_glossmark=false;

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
  sbookSetupSummaryDiv(sbookGlossesHUD);
  sbookShowSummaries(sbook_allglosses,sbookGlossesHUD,false);
  return sbookGlossesHUD;
}

function sbookCreateSourceHUD(classinfo,overlays)
{
  if (sbookSourceHUD) return sbookSourceHUD;
  if (!(overlays)) overlays=sbook_conversants;
  if (!(classinfo)) classinfo=".overlays.hudblock.hud#SBOOKSOURCES";
  var app_button=
    fdjtImage(sbicon("sbooksappicon40x40.png"),".button.app","?","Help, settings, etc");
  var login_button=
    fdjtImage(sbicon("sbooksconnecticon40x40.png"),".button.login","?",
	      "click to login");
  var everyone_button=
    fdjtImage(sbicon("sBooksWE_2_32x32.png"),".button.everyone#SBOOKEVERYONE","everyone");
  var sourceicons=fdjtDiv("#SBOOKSOURCEICONS.sourceicons",everyone_button);
  var socialelts=[]; var glosselts=[];
  everyone_button.onclick=sbookEveryoneButton_onclick;
  login_button.onclick=sbookLoginButton_onclick;
  sourceicons.onclick=sbookOverlays_onclick;
  app_button.onclick=sbookAppButton_onclick;
  var i=0; var n=overlays.length;
  while (i<n) sbookAddSourceIcon(fdjtOIDs[overlays[i++]]);
  sbookSourceHUD=fdjtDiv(classinfo," ",
		       login_button,app_button,
		       sourceicons);
  sbookSourceHUD.onclick=sbookLeftEdge_onclick;
  return sbookSourceHUD;
}

function sbookAddSourceIcon(info)
{
  var humid=info.humid;
  var icon=$("SBOOKSOURCEICON"+humid);
  if (icon) return icon;
  if (!(info.name)) return;
  var pic=info.pic; var kind=info.kind;
  if (pic) {}
  else if (kind===':PERSON')
    pic=sbicon("sbooksperson40x40.png");
  else if (kind===':CIRCLE')
    pic=sbicon("sbookscircle40x40.png");
  else if (kind===':OVERDOC')
    pic=sbicon("sbooksoverdoc40x40.png");
  else pic=sbook;
  icon=fdjtImage
    (pic,".button.source",info.name|info.kind,
     ("click to see glosses for "+info.name));
  icon.oid=info.oid; icon.id="SBOOKSOURCEICON"+humid;
  fdjtInsertBefore("SBOOKEVERYONE"," ",icon);
  return icon;
}

function sbookEveryoneButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_sources) {
    var overlays=$$(".source",sbookSourceHUD);
    var i=0; var n=overlays.length;
    while (i<n) fdjtDropClass(overlays[i++],"selected");
    sbook_sources=false;
    if (sbook_mode==="glosses") {
      sbookSelectSources($("SBOOKGLOSSES"));
      sbookSelectTargets($("SBOOKGLOSSES"));
      sbookScrollGlosses(sbook_focus);}
    else if ((sbook_mode==="searching")||(sbook_mode==="browsing"))
      sbookSelectSources($("SBOOKSUMMARIES"));
    else sbookHUDMode("glosses");}
  else if (sbook_mode==='glosses') sbookHUDMode(false);
  else sbookHUDMode("glosses");
  fdjtDropClass(sbookHUD,"onepassage");
  fdjtCancelEvent(evt);
}

function sbookOverlays_onclick(evt)
{
  evt=evt||event||null;
  // if (!(sbook_user)) return;
  var target=$T(evt);
  var overlays=$P(".sourceicons",target);
  if (!(overlays)) return; /* Warning? */
  if (!(target.oid)) return;
  var info=fdjtOIDs[target.oid];
  var icon=$("SBOOKSOURCEICON"+info.humid);
  if (!(info)) return;
  if ((icon)&&(fdjtHasClass(icon,"selected"))&&
      (sbook_sources.length===1)&&
      (!((evt.shiftKey)||(evt.ctrlKey)))) {
    if ((sbook_mode==='glosses')||
	(sbook_mode==='searching')||
	(sbook_mode==='browsing')) 
      sbookHUDMode(false);
    else if ((sbook_last_mode==='glosses')||
	     (sbook_last_mode==='searching')||
	     (sbook_last_mode==='browsing'))
      sbookHUDMode(sbook_last_mode);
    else sbookHUDMode("glosses");
    fdjtCancelEvent(evt);
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
      var sourceicons=$$(".source",overlays);
      var i=0; var len=sourceicons.length;
      while (i<len) fdjtDropClass(sourceicons[i++],"selected");}
    fdjtAddClass(icon,"selected");
    sbook_sources=new Array(target.oid);}
  if ((sbook_sources) && (sbook_sources.length===0)) sources=false;
  if (!(sbook_mode)) {
    sbookSelectSources($("SBOOKGLOSSES"),sbook_sources);
    sbookSelectTargets($("SBOOKGLOSSES"));
    sbookScrollGlosses(sbook_focus);
    sbookHUDMode("glosses");}
  else if (sbook_mode==="glosses") {
    sbookSelectSources($("SBOOKGLOSSES"),sbook_sources);
    sbookSelectTargets($("SBOOKGLOSSES"));
    sbookScrollGlosses(sbook_focus);}
  else if (sbook_mode==="browsing") 
    sbookSelectSources($("SBOOKSUMMARIES"),sbook_sources);
  else if ((sbook_mode==="searching")&&
	   (sbook_query)&&(sbook_query._query)&&
	   (sbook_query._query>0)) {
    sbookShowSearch(sbook_query);
    sbookSelectSources($("SBOOKSUMMARIES"),sbook_sources);
    sbookHUDMode("browsing");}
  else {
    sbookSelectSources($("SBOOKGLOSSES"),sbook_sources);
    sbookSelectTargets($("SBOOKGLOSSES"));
    sbookScrollGlosses(sbook_focus);
    sbookHUDMode("glosses");}
  fdjtDropClass(sbookGlossesHUD,"onepassage");
  fdjtCancelEvent(evt);
}

function sbookSetSources(overlays,sources)
{
  var children=overlays.childNodes;
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
    var i=0; var len=children.length; while (i<len) {
      var child=children[i++];
      if (child.nodeType===1) {
	if ((child.blockloc) &&
	    (child.blockloc>=targetloc) &&
	    (child.offsetHeight>0)) {
	  var off=fdjtGetOffset(child,false,glosses);
	  glosses.scrollTop=off.top;
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
  var imgsrc=((target)?(sbicon("sbookspeople32x32.png")):
	      (sbicon("remarkballoon32x32.png")));
  // By default the glossmark image is the user when unique
  if (sources.length===1) imgsrc=(fdjtOIDs[sources[0]].pic)||imgsrc;
  var glossmark=fdjtSpan
    ("glossmark",
     fdjtImage(imgsrc,"big","comments"),
     fdjtImage(sbicon("sbicon16x16.png"),"tiny","+"));
  glossmark.onclick=sbookGlossmark_onclick;
  glossmark.onmousedown=fdjtCancelEvent;
  glossmark.onmouseover=sbookGlossmark_onmouseover;
  glossmark.onmouseout=sbookGlossmark_onmouseout;
  if (id) {
    target.glossmarkid=glossmark.id="SBOOK_GLOSSMARK_"+id;
    glossmark.sbook_ref=id;}
  if ((target)&&(sbook_glossmark_qricons)) {
    var qrhref="http://"+sbook_server+"/sbook/qricon.fdcgi?"+
      "URI="+encodeURIComponent(sbook_refuri)+
      ((id)?("&FRAG="+id):"")+
      ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
    var i=0; while (i<tags.length) qrhref=qrhref+"&TAGCUE="+tags[i++];
    fdjtPrepend(target,fdjtImage(qrhref,"sbookqricon"));}
  if (target) {
    fdjtAddClass(target,"glossed");
    fdjtPrepend(target,glossmark);}
  glossmark.sbookui=true;
  return glossmark;
}

function sbookGlossmark_onclick(evt)
{
  evt=evt||event||null;
  var target=sbookGetRef(evt.target)||sbookGetFocus(evt.target.parentNode);
  if ((sbook_mode==="glosses") &&
      (sbook_glosses_target===target)) {
    fdjtCancelEvent(evt);
    sbookHUDMode(false);
    return;}
  if (sbook_focus!==target) sbookSetFocus(target);
  sbook_glosses_target=target;
  if ((evt.shiftKey)||(evt.ctrlKey)) {
    sbookSelectSources(sbookGlossesHUD,sbook_sources);
    sbookSelectTargets(sbookGlossesHUD,target.id);}
  else {
    sbookSelectSources(sbookGlossesHUD);
    sbookSelectTargets(sbookGlossesHUD,target.id);}
  fdjtAddClass(sbookGlossesHUD,"onepassage");
  sbook_glossmark=$P(".glossmark",evt.target);
  sbookMarkHUDSetup(target);
  // $("SBOOKMARKFORM").removeAttribute('mode');
  fdjtAddClass($("SBOOKMARKFORM"),"closed");
  fdjtAppend("SBOOKGLOSSES",$("SBOOKMARK"));
  sbookHUDMode("glosses");
  // fdjtSetScroll(false,75,sbook_glossmark);
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
