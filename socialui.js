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
  var everyone_button=
    fdjtImage(sbicon("sbookspeople40x40.png"),
	      ".button.everyone.selected",
	      "click to see all glosses");
  var allsources=fdjtDiv("#SBOOKSOURCES.sbooksources",everyone_button);
  everyone_button.onclick=sbookEveryoneButton_onclick;
  allsources.onclick=sbookSources_onclick;
  
  var allglosses=fdjtDiv("#SBOOKALLGLOSSES.sbooksummaries.scrollable");
  sbookSetupSummaryDiv(allglosses);
  sbookShowSummaries(sbook_allglosses,allglosses,false);
  
  sbookGlossesHUD=
    fdjtDiv(classinfo||"#SBOOKGLOSSES.sbookglosses.hudblock.scrollhud",
	    allsources,allglosses);
  
  return sbookGlossesHUD;
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
     ("click to show/hide glosses from "+info.name));
  icon.oid=info.oid; icon.id="SBOOKSOURCEICON"+humid;
  fdjtAppend("SBOOKSOURCES"," ",icon);
  return icon;
}

function sbookEveryoneButton_onclick(evt)
{
  evt=evt||event||null;
  var target=$T(evt);
  var sources=$P(".sbooksources",target);
  var glosses=$P(".sbookglosses",target);
  var summaries=$$(".sbooksummaries",glosses)[0];
  var new_sources=[];
  if ((!(sources))||(!(glosses)))
    return; /* Warning? */
  if (fdjtHasClass(target,"selected")) {
    sbookHUDMode(false);
    fdjtCancelEvent(evt);
    return;}
  var selected=$$(".selected",sources);
  fdjtToggleClass(selected,"selected");
  fdjtAddClass(target,"selected");
  sbookSelectSources(summaries,false);
  fdjtCancelEvent(evt);
}

function sbookSources_onclick(evt)
{
  evt=evt||event||null;
  // if (!(sbook_user)) return;
  var target=$T(evt);
  var sources=$P(".sbooksources",target);
  var glosses=$P(".sbookglosses",target);
  var summaries=$$(".sbooksummaries",glosses)[0];
  var new_sources=[];
  if ((!(sources))||(!(glosses))||(!(target.oid)))
    return; /* Warning? */
  fdjtToggleClass(target,"selected");
  var selected=$$(".selected",sources);
  var i=0; var len=selected.length;
  while (i<len) {
    var oid=selected[i++].oid;
    if (oid) new_sources.push(oid);}
  var everyone=$$(".everyone",sources)[0];
  if (new_sources.length) {
    if (everyone) fdjtDropClass(everyone,"selected");
    sbookSelectSources(summaries,new_sources);}
  else {
    if (everyone) fdjtAddClass(everyone,"selected");
    sbookSelectSources(summaries,false);}
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
    if (!(glosses)) glosses=$("SBOOKALLGLOSSES");
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

var sbook_glossmark_div=false;
var sbook_glossmark_target=false;

function sbookOpenGlossmark(target,addmark)
{
  if (sbook_glossmark_target===target) {
    var hud=$("SBOOKMARKHUD");
    hud.style.maxHeight=(window.innerHeight-100);
    sbookHUDMode("mark");}
  else {
    var hud=$("SBOOKMARKHUD");
    var glosses=sbook_glosses_by_id[target.id];
    var sumdiv=fdjtDiv(".sbooksummaries");
    sbookSetupSummaryDiv(sumdiv);
    if (glosses)
      sbookShowSummaries(glosses,sumdiv,false);
    fdjtReplace("SBOOKMARKGLOSSES",sumdiv);
    sbookSetFocus(target);
    sbookSetTarget(target);
    sbook_glossmark_target=target;
    sbookMarkHUDSetup(target);
    if (addmark)
      fdjtDropClass($("SBOOKMARKFORM"),"closed");
    else fdjtAddClass($("SBOOKMARKFORM"),"closed");
    var offinfo=fdjtGetOffset(target);
    hud.style.maxHeight=(window.innerHeight-100)+'px';
    hud.style.opacity=0.0; hud.style.display='block';
    var hudinfo=fdjtGetOffset(hud);
    var minoff=(window.scrollY+window.innerHeight)-hudinfo.height;
    hud.style.opacity=null; hud.style.display=null;
    if (offinfo.top<minoff) 
      hud.style.top=offinfo.top+'px';
    else hud.style.top=minoff+'px';
    sbookHUDMode("mark");}
}

function sbookGlossmark_onclick(evt)
{
  evt=evt||event||null;
  var target=sbookGetRef(evt.target);
  if (sbook_glossmark_target===target)
    if (sbook_mode) sbookHUDMode(false);
    else sbookOpenGlossmark(target,false);
  else sbookOpenGlossmark(target,false);
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
