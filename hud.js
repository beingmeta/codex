/* -*- Mode: Javascript; -*- */

var sbooks_hud_id="$Id: domutils.js 40 2009-04-30 13:31:58Z haase $";
var sbooks_hud_version=parseInt("$Revision: 40 $".slice(10,-1));

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

// This is the HUD top element
var sbookHUD=false;
// Whether the HUD is up
var sbook_hudup=false;

// Whether the HUD was 'forced down' (by a user action)
// This makes it harder to come back up automatically
var sbookHUD_suppressed=false;
// Whether the HUD state was forced
var sbookHUD_forced=false;

// The keycode for bringing the HUD up and down
var sbook_hudkey=27;
// Whether we are previewing a section
var sbook_saved_scrollx=false, sbook_saved_scrolly=false;

// Where graphics can be found
var sbook_graphics_root="/static/graphics/";

function createSBOOKHUD()
{
  var hud=$("SBOOKHUD");
  if (hud) return hud;
  else {
    var tophud=createSBOOKHUDtop();
    var bottomhud=createSBOOKHUDbottom();
    var hud=fdjtDiv("#SBOOKHUD",tophud,bottomhud);
    sbookHUD=hud;
    fdjtPrepend(document.body,hud);
    return hud;}
}

function createSBOOKHUDtop()
{
  var tophud=fdjtDiv
    ("#SBOOKTOPHUD",
     sbookBUTTON("SBOOKPREV","LeftTriangle32.png",
		 "Javascript:sbookHUD_Prev();",false),
     sbookBUTTON("SBOOKNAVBUTTON","CompassIcon32x32.png",
		 "Javascript:sbookHUD_NavMode();",sbookHUD_NavMode),
     fdjtDiv("#SBOOKTOC"),
     createSBOOKHUDsearch(),
     sbookBUTTON("SBOOKSEARCHBUTTON","SearchIcon32.png",
		 "Javascript:sbookHUD_SearchMode();",sbookHUD_SearchMode),
     sbookBUTTON("SBOOKNEXT","RightTriangle32.png",
		 "Javascript:sbookHUD_Next();"));
  tophud.onmouseover=sbookHUD_onmouseover;
  tophud.onmouseout=sbookHUD_onmouseout;
  tophud.onclick=function(evt) {sbookSetHUD("top");}
  return tophud;
}

 function createSBOOKHUDbottom()
{
  var bottomhud=fdjtDiv
    ("#SBOOKBOTTOMHUD",
     sbookBUTTON("SBOOKPREVECHO","LeftTriangle32.png",
		 "Javascript:sbookHUD_PrevEcho();"),
     sbookBUTTON("SBOOKECHOBUTTON",sbook_echoes_icon(window.location.href),
		 "Javascript:sbookHUD_EchoMode();",sbookHUD_EchoMode),
     createSBOOKHUDsocial(),
     createSBOOKHUDping(),
     sbookBUTTON("SBOOKPINGBUTTON","remarkballoon32x32.png",
		 "Javascript:sbookHUD_PingMode();",sbookHUD_PingMode),
     sbookBUTTON("SBOOKNEXTECHO","RightTriangle32.png",
		 "Javascript:sbookHUD_NextEcho();"));
  bottomhud.onmouseover=sbookHUD_onmouseover;
  bottomhud.onmouseout=sbookHUD_onmouseout;
  bottomhud.onclick=function(evt) {sbookSetHUD("bottom");}
  return bottomhud;
}

function sbookBUTTON(id,graphic,anchor,clickfn)
{
  var imgsrc=
    (((graphic.search("http")===0) || (graphic.search("/")===0)) ? (graphic) :
     (sbook_graphics_root+"/"+graphic));
  var elt=fdjtAnchor(anchor,fdjtImage(imgsrc,false,id));
  elt.id=id; elt.className="button";
  if (clickfn) elt.onclick=clickfn;
  return elt;
} 

/* Mode controls */

var sbookHUD_modepat=/(hudhover)|(hudtopdown)|(hudbottomup)/g;
var sbookHUD_modes=["bottom","top","nav","search","echoes","ping"];
var sbookHUD_lastmode="nav";

function sbookSetHUD(flag,forced)
{
  // fdjtTrace("Setting HUD to %o/%o",flag,forced);
  if (!(flag)) {
    fdjtDropClass(document.body,sbookHUD_modepat);
    sbookHUD.blur(); document.body.focus();
    if (forced) {
      sbookHUD_forced=false;
      sbookHUD_suppressed=true;}
    sbook_hudup=false;}
  else {
    var body=document.body;
    if ((typeof flag !== "string") ||
	(sbookHUD_modes.indexOf(flag)<0))
      flag=sbookHUD_lastmode;
    sbookHUD_lastmode=flag;
    if ((flag==="top") || (flag==="nav") || (flag==="search"))
      fdjtSwapClass(body,sbookHUD_modepat,"hudtopdown");
    else fdjtSwapClass(body,sbookHUD_modepat,"hudbottomup");
    if (flag==="nav") fdjtDropClass(body,"search","mode");
    else if (flag==="search") fdjtAddClass(body,"search","mode");
    else if (flag==="echoes") fdjtDropClass(body,"ping","mode");
    else if (flag==="ping") fdjtAddClass(body,"ping","mode");
    else {}
    // fdjtTrace("body.class=%o, body.mode=%o",body.className,body.getAttribute("mode"));
    if (forced) {
      sbookHUD_forced=true;
      sbookHUD_suppressed=false;}
    sbook_hudup=true;}
}


function sbookHUD_NavMode(evt)
{
  sbookSetHUD("nav");
  fdjtDropClass(document.body,"preview");
  $("SBOOKNAVBUTTON").blur();
  if (evt) {
    evt.preventDefault();
    evt.cancelBubble=true;}
  return false;
}

function sbookHUD_SearchMode(evt)
{
  if (evt) {
    evt.preventDefault();
    evt.cancelBubble=true;}
  if ((fdjtHasClass(document.body,"hudtopdown")) &&
      (fdjtHasClass(document.body,"search","mode"))) {
    $("SBOOKSEARCHBUTTON").blur();
    fdjtDropClass(document.body,"search","mode");
    return;}
  sbookSetHUD("search");
  fdjtDropClass(document.body,"preview");
  $("SBOOKSEARCHBUTTON").blur();
  $("SBOOKSEARCHTEXT").focus();
  return false;
  /*
  if (evt) {
    evt.preventDefault();}
  if ((evt) && (evt.target)) evt.target.blur();
  if (!(sbook_full_cloud)) {
    var full_cloud=sbookFullCloud();
    var input_elt=$("SBOOKSEARCHTEXT");
    if ((input_elt.value) && (input_elt.value.length===0))
      fdjtSetCompletions("SBOOKSEARCHCOMPLETIONS",full_cloud);}
  if (fdjtHasClass(document.body,"search","mode"))  {
    fdjtDropClass(document.body,"results","mode");
    fdjtDropClass(document.body,"social","mode");
    fdjtDropClass(document.body,"search","mode");}
  else {
    fdjtDropClass(document.body,"social","mode");
    fdjtAddClass(document.body,"search","mode");
    $("SBOOKSEARCHTEXT").focus();}
  */
}

var sbook_pingsrc=false;

function sbookHUD_PingMode(evt)
{
  var body=document.body;
  if (evt) {
    evt.preventDefault();
    evt.cancelBubble=true;}
  if ((fdjtHasClass(body,"hudbottomup")) &&
      (fdjtHasClass(document.body,"ping","mode"))) {
    $("SBOOKPINGBUTTON").blur();
    fdjtDropClass(document.body,"ping","mode");
    return;}
  sbookSetHUD("ping",true);
  fdjtDropClass(document.body,"preview");
  $("SBOOKPINGBUTTON").blur();
  var newsrc=sbook_podspot_uri(sbook_base,window.location.hash,document.title,false);
  if (sbook_pingsrc!==newsrc) {
    sbook_pingsrc=newsrc;
    $("SBOOKPING").src=newsrc;}
  return false;
  /* 
  if (sbook_echo_head != sbook_head) {
    if (sbook_echoes_iframe)
      sbook_echoes_iframe.src=
	sbook_podspot_uri(location.href,sbookGetStableId(sbook_head),
			  sbook_title_path(sbook_head),sbook_tribes);
    sbook_echo_head=sbook_head;}
  fdjtToggleClass(document.body,"social","mode");
  fdjtDropClass(document.body,"search","mode");
  if (evt) {
    evt.preventDefault();
    evt.cancelBubble=true;}
  if ((evt) && (evt.target)) evt.target.blur();
  $("SBOOKECHOESBUTTON").blur();
  */
}

function sbookHUD_EchoMode(evt)
{
  sbookSetHUD("echoes");
  fdjtDropClass(document.body,"preview");
  $("SBOOKECHOBUTTON").blur();
  if (evt) {
    evt.preventDefault();
    evt.cancelBubble=true;}
  return false;
}

function sbookPreview(elt,nomode)
{
  var offset=
    ((fdjtHasClass(document.body,"hudtopdown")) ?
     ($("SBOOKTOPHUD").offsetHeight) :
     (fdjtHasClass(document.body,"hudbottomup")) ?
     ($("SBOOKTOPHUD").offsetXPos) : (60));
  if (elt) fdjtScrollPreview(elt,false,-offset);
  if (!(nomode)) fdjtAddClass(document.body,"preview");
}

// What to use as the podspot image URI.  This 'image' 
//  really invokes a script to pick or generate a
//  image for the current user and document.
var sbook_podspot_img="sBooksWE_32x32.png";
function sbook_echoes_icon(uri)
{
  return sbook_webechoes_root+"podspots/"+sbook_podspot_img+
    ((uri) ? ("?URI="+encodeURIComponent(uri)) : "");
}

/* Handlers */

function sbookHUD_onhover(hover)
{
  if (sbook_hudup) return;
  if (hover)
    fdjtAddClass(document.body,"hudhover");
  else fdjtDropClass(document.body,"hudhover");
}

function sbookHUD_onmouseover(evt)
{
  if (sbook_hudup) {
    if (document.body.hudhide) clearTimeout(document.body.hudhide);
    return;}
  if (evt.target)
    fdjtDelayHandler(100,sbookHUD_onhover,true,sbookHUD);
  evt.cancelBubble=true;
}

function sbookHUD_onmouseout(evt)
{
  var target=evt.target;
  if (sbook_hudup)
    if (sbookHUD_forced) return;
    else document.body.hudhide=
	   setTimeout(function(evt) { sbookSetHUD(false); },100);
  else if (evt.target)
    fdjtDelayHandler(100,sbookHUD_onhover,false,sbookHUD);
}

function sbookGetStableId(elt)
{
  var info=sbook_getinfo(elt);
  // fdjtLog("Scrolling to %o with id %s/%s",target,info.id,target.id);
  if ((info) && (info.id) && (!(info.id.search(/TMPID/)==0)))
    return info.id;
  else if ((elt.id) && (!(elt.id.search(/TMPID/)==0)))
    return elt.id;
  else return false;
}

/* TOC handlers */

function sbookTOC_onmouseover(evt)
{
  if (sbookHUD_suppressed) return;
  if (!(sbook_hudup)) return;
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  var head=target.headelt;
  if (head) sbookPreview(head,true);
  evt.cancelBubble=true;
  evt.preventDefault();
}

function sbookTOC_onmouseout(evt)
{
  fdjtScrollRestore();
  fdjtDropClass(document.body,"preview");
  evt.cancelBubble=true;
  evt.preventDefault();
}

var sbookTOCHighlighted=false;
var sbookTOCHighlights=false;

function sbookTOCHighlight(secthead)
{
  if (secthead===sbookTOCHighlighted) return;
  if (!(sbook_electric_spanbars)) return;
  if (sbookTOCHighlighted) {
    var highlights=sbookTOCHighlights;
    sbookTOCHighlighted=false;
    sbookTOCHighlights=null;
    var i=0; while (i<highlights.length) {
      var sect=highlights[i++]; 
      sect.style.color=null; sect.style.backgroundColor=null;}}
  var highlights=new Array();
  var sections=fdjtGetChildrenByClassName(sbookHUD,"sbookhudsect");
  var spanelts=fdjtGetChildrenByClassName(sbookHUD,"sbookhudspan");
  var i=0; while (i<sections.length) {
    var sect=sections[i++];
    if (sect.headelt===secthead) {
      sect.style.color='orange';
      highlights.push(sect);}}
  i=0; while (i<spanelts.length) {
    var sect=spanelts[i++];
    if (sect.headelt===secthead) {
      sect.style.backgroundColor='orange';
      highlights.push(sect);}}
  sbookTOCHighlighted=secthead;
  sbookTOCHighlights=highlights;
}

function sbookTOC_onmouseout(evt)
{
  var rtarget=evt.relatedTarget;
  if (!(rtarget)) return;
  try {
    if (rtarget.ownerDocument!=document) {
      sbookHUD_hider=setTimeout(sbookHUD_hide,300);
      return;}
    // We'll get an error if we go out of the document,
    // in which case we probably want to hide anyway
    while (rtarget)
      if (rtarget===sbookHUD) return;
      else if (rtarget===document.body) break;
      else rtarget=rtarget.parentNode;}
  catch (e) {
    sbook_hud_suppressed=false;
    sbookHUD_hider=setTimeout(sbookHUD_hide,300);
    return;}
  sbook_hud_suppressed=false;
}

function sbookTOC_onclick(evt)
{
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  if (!(sbook_hudup)) {
    sbookSetHUD("top",true);
    return;}
  evt.preventDefault();
  evt.cancelBubble=true;
  sbookSetHead(target.headelt);
  var info=sbook_getinfo(target.headelt);
  sbookScrollTo(target.headelt);
  if (!((info.sub) && ((info.sub.length)>2)))
    sbookSetHUD(false);
  return false;
}

/* Other stuff */

function sbookHUD_unhighlight(elt_arg)
{
  var elt=((elt_arg) || sbookHUD_highlighted_elt);
  if (elt) {
    var alt=((elt._sbook_span_elt) || (elt._sbook_name_elt) || (false));
    fdbDropClass(elt,"highlighted");}
}

function sbookHUD_Next(evt)
{
  var curinfo=sbook_head.sbookinfo;
  var goto=curinfo.next;
  if (!(goto)) goto=curinfo.sbook_head.sbookinfo.next;
  if (goto) {
    sbookSetHead(goto);
    sbookScrollTo(goto);}
  if (evt) evt.cancelBubble=true;
  sbookSetHUD(false);
}

function sbookHUD_Prev(evt)
{
  var curinfo=sbook_head.sbookinfo;
  var goto=curinfo.prev;
  if (!(goto)) goto=curinfo.sbook_head.sbookinfo.prev;
  if (goto) {
    sbookSetHead(goto);
    sbookScrollTo(goto);}
  if (evt) evt.cancelBubble=true;
  sbookSetHUD(false);
}

/* This initializes the HUD state to the initial location with the
   document, using the hash value if there is one. */ 
function sbookHUD_Init()
{
  var hash=window.location.hash, target=document.body;
  if ((typeof hash === "string") && (hash.length>0)) {
    if ((hash[0]==='#') && (hash.length>1))
      target=sbook_hashmap[hash.slice(1)];
    else target=sbook_hashmap[hash];}
  if (!(target))
    target=document.body;
  if (target!=document.body) target.scrollIntoView();
  sbookSetHead(target);
  if (target.sbookloc) sbookSetLocation(target.sbookloc);
  // window.location=window.location;
}

