/* -*- Mode: Javascript; -*- */

var sbooks_social_id="$Id: domutils.js 40 2009-04-30 13:31:58Z haase $";
var sbooks_social_version=parseInt("$Revision: 40 $".slice(10,-1));

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
var social_oids=[];
var social_info={};
var sbook_echoes_by_pingid={};
var sbook_echoes_by_user={};
var sbook_echoes_by_tags={};
var sbook_echoes_by_xtags={};
var sbook_echoes_by_tribe={};
var sbook_echoes_by_id={};

var sbook_echo_remark_icon=
  "http://static.beingmeta.com/graphics/remarkballoon16x13.png";
var sbook_echo_more_icon=
  "http://static.beingmeta.com/graphics/Asterisk16x16.png";
var sbook_echo_eye_icon=
  "http://static.beingmeta.com/graphics/EyeIcon20x16.png";

/* Social UI components */

function createSBOOKHUDsocial()
{
  if (sbookHUDechoes) return sbookHUDechoes;
  var ping_button=
    fdjtImage("http://static.beingmeta.com/graphics/remarkballoon32x25.png",
	      "button ping","add");
  var everyone_button=
    fdjtImage("http://static.beingmeta.com/graphics/sBooksWE_2_32x32.png",
	      "button everyone","everyone");
  var socialbar=
    fdjtDiv("#SBOOKSOCIAL.socialbar"," ",everyone_button,ping_button);
  var echoeshud=fdjtDiv("#SBOOKECHOES.echoes"," ");
  var socialelts=[]; var echoelts=[];
  var i=0; while (i<sbook_allechoes.length) {
    var echo=sbook_allechoes[i++];
    var echo_elt=sbookEchoToEntry(echo);
    echoelts.push(echo_elt);
    fdjtAppend(echoeshud,echo_elt,"\n");}
  i=0; while (i<social_oids.length) {
    var oid=social_oids[i++];
    var info=social_info[oid];
    var img=fdjtImage(info.squarepic,"social",info.name);
    img.oid=oid; img.name=info.name;
    if (info.summary) img.title=info.summary;
    else img.title=info.name;
    socialelts.push(img);
    fdjtAppend(socialbar,img);}
  everyone_button.onclick=function(evt) {
    evt.target.blur();
    sbookSetEchoFocus(false);
    if (fdjtHasClass(document.body,"hudechoes"))
      sbookSetHUD("hudup");
    else sbookSetHUD("hudechoes");};
  socialbar.onclick=function(evt) {
    evt.target.blur();
    if (evt.target.oid) {
      sbookSetEchoFocus(evt.target.oid);
      sbookSetHUD("hudechoes");}};
  ping_button.onclick=function(evt) {
    var iframe;
    evt.target.blur();
    if ((sbook_focus_elt) &&
	(sbook_focus_elt.podspot) &&
	(sbook_focus_elt.podspot.iframe))
      iframe=sbook_focus_elt.podspot.iframe;
    else if ((sbook_focus_elt) &&
	     (sbook_focus_elt.podspot))
      iframe=sbook_focus_elt.podspot.openIFrame();
    else {
      var elt=((sbook_head)||(document.body));
      var podspot=add_podspot(elt,true);
      iframe=podspot.iframe;};};

  sbookHUDsocial=socialbar;
  sbookHUDechoes=echoeshud;
  echoeshud.echoelts=echoelts;
  echoeshud.socialelts=socialelts;
  return new Array(sbookHUDechoes,sbookHUDsocial);
}

function sbookSetEchoes(echoes)
{
  fdjtTrace("sbookSetEchoes %o",echoes);
  var pingids=[]; var social=[]; var seen={};
  var i=0; while (i<echoes.length) {
    var echo=echoes[i++]; var user=echo.user;
    if (echo.pingid) pingids.push(echo.pingid);
    if (!(seen[user])) {social.push(user); seen[user]=user;}
    if (echo.tribes) {
      var j=0; var tribes=echo.tribes;
      while (j<tribes.length) {
	var tribe=tribes[j++];
	if (!(seen[tribe])) {social.push(tribe); seen[tribe]=tribe;}}}}
  var echoelts=sbookHUDechoes.echoelts;
  i=0; while (i<echoelts.length) {
    var echoelt=echoelts[i++];
    if ((echoelt.pingid) && (pingids.indexOf(echoelt.pingid)>=0)) 
      echoelt.setAttribute("displayed","yes");
    else echoelt.setAttribute("displayed","no");}
  var socialelts=sbookHUDechoes.socialelts;
  i=0; while (i<socialelts.length) {
    var socialelt=socialelts[i++];
    if (social.indexOf(socialelt.oid)>=0)
      socialelt.setAttribute("displayed","yes");
    else socialelt.setAttribute("displayed","no");}
}

function sbookSetEchoFocus(userortribe)
{
  // fdjtTrace("sbookSetEchoFocus %o",userortribe);
  if (userortribe) {
    var echoelts=sbookHUDechoes.echoelts;
    i=0; while (i<echoelts.length) {
      var echoelt=echoelts[i++];
      if (echoelt.user===userortribe)
	echoelt.setAttribute("focus","yes");
      else if ((echoelt.tribes) &&
	       (echoelt.tribes.indexOf(userortribe)>=0)) 
	echoelt.setAttribute("focus","yes");
      else echoelt.setAttribute("focus","no");}}
  else {
    var echoelts=sbookHUDechoes.echoelts;
    i=0; while (i<echoelts.length) 
	   echoelts[i++].removeAttribute("focus");}
}

function sbookEchoToEntry(echo)
{
  var user=echo.user;
  var userinfo=social_info[user];
  var usrimg=fdjtImage(userinfo.squarepic,"userpic",userinfo.name);
  var userblock=fdjtDiv("userblock",usrimg);
  var icons=fdjtSpan("icons");
  var topics=fdjtDiv("topics");
  var extra=sbookEchoExtras(echo);
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
  anchor.onclick=function(evt) {
    evt.target.blur(); sbookScrollTo(target);
    evt.cancelBubble=true; evt.preventDefault();}
  entry.uri=echo.uri; entry.tags=echo.tags; entry.fragid=echo.fragid;
  if (echo.tribes) entry.tribes=echo.tribes;
  entry.user=user; entry.pingid=echo.pingid;
  return entry;
}

function sbookEchoIcons(echo,extra)
{
  var eye=fdjtImage(sbook_echo_eye_icon,"eye","(\u00b7)");
  var comment=fdjtImage(sbook_echo_remark_icon,".button.relayb","+");
  var showmore=((extra) &&
		fdjtImage(sbook_echo_more_icon,".button.extrab","*"));
  var age=fdjtAnchorC("http://webechoes.net/echo/"+echo.pingid,
		      "age",fdjtIntervalString(fdjtTick()-echo.tstamp)," ago");
  age.target="_blank";
  var targetid=echo.fragid; var target=$(targetid);
  if (!(target)) eye=false;
  else {
    eye.title=_("previewing: move mouse to restore");
    eye.onclick=function(evt){
      if (document.body.preview) clearTimeout(document.body.preview);
      sbookStopPreview(target); sbookScrollTo(target);
      evt.preventDefault(); evt.cancelBubble=true;
      sbookSetHUD(false);};
    eye.onmouseover=function(evt){
      fdjtDelayHandler(300,sbookPreview,target,document.body,"preview");};
    eye.onmouseout=function(evt){
      fdjtDelayHandler(300,sbookStopPreview,target,document.body,"preview");};}
  comment.title=_("Add your own response");
  comment.onclick=function(evt){
    sbookSetHUD(false);
    add_podspot(target,true);}; 
  showmore.title=_("See more information");
  showmore.onclick=function(evt){
    fdjtToggleClass($P('.echo',evt.target),'extras','shown',true);}; 
  return fdjtSpan("icons",age,showmore,comment,eye);
}

function sbookEchoTags(tags)
{
  var topics=fdjtDiv("topics");
  var i=0; while (i<tags.length) {
    if (i>0)
      fdjtAppend(topics,"\u00b7",knoDTermSpan(tags[i++]));
    else fdjtAppend(topics,knoDTermSpan(tags[i++]));}
  return topics;
}

function sbookEchoExtras(echo)
{
  var details=false; var xrefs=false;
  if (echo.details) details=fdjtDiv("details",echo.details);
  if (echo.xrefs) {
    var uris=echo.xrefs; xrefs=[];
    var i=0; while (i<uris.length) 
	       xrefs.push(fdjtAnchor(uris[i++],"xref"));}
  if ((details) || (xrefs))
    return fdjtDiv("extras",details,xrefs);
  else return false;
}

/* The Echoes/Social Database */

function importSocialData(data)
{
  if (!(data))
    if (typeof sbook_echoes_data === "undefined") {
      fdjtWarn("No social data available");
      return;}
    else data=sbook_echoes_data;
  var info=data['%info'];
  if ((info) && (info.length)) {
    var i=0; while (i<info.length) {
      var item=info[i++];
      if (!(social_info[item.oid])) social_oids.push(item.oid);
      social_info[item.oid]=item;}}
  var ids=data['%ids'];
  if ((ids) && (ids.length)) {
    var i=0; while (i<ids.length) {
      var id=ids[i++];
      var element=$(id);
      if (element) add_podspot(element);
      var entries=data[id];
      var j=0; while (j<entries.length) {
	var entry=entries[j++];
	var pingid=entry.pingid;
	var user=entry.user;
	var item=sbook_echoes_by_pingid[pingid];
	if (!(item)) {
	  sbook_allechoes.push(entry);
	  sbook_echoes_by_pingid[pingid]=entry;
	  item=entry;}
	item.fragid=id;
	fdjtAdd(sbook_echoes_by_id,id,item);
	if (entry.tags) {
	  var tags=entry.tags;
	  var k=0; while (k<tags.length) {
	    var tag=tags[k++]; 
	    if (item!=entry) fdjtAdd(item,'tags',tag,true);
	    if (knowlet) {
	      var knowde=knowlet.handleSubjectEntry(tag);
	      fdjtAdd(sbook_echoes_by_xtag,knowde.dterm,item);
	      var l=0; var genls=knowde.allGenls;
	      while (l<genls.length) {
		fdjtAdd(sbook_echoes_by_xtag,genls[l++].dterm,item);}}
	    fdjtAdd(sbook_echoes_by_tag,tag,item);}}
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
	if ((entry.uri) && (item!=entry)) item.uri=entry.uri;
	if ((entry.msg) && (item!=entry)) item.msg=entry.msg;
	if ((entry.excerpt) && (item!=entry)) item.excerpt=entry.excerpt;}}}
    sbook_allechoes.sort(function(x,y) {
      if ((x.fragid)<(y.fragid)) return -1;
      else if ((x.fragid)==(y.fragid))
	if ((x.tstamp)<(y.tstamp)) return -1;
	else if ((x.tstamp)===(y.tstamp)) return 0;
	else return 1;
      else return 1;});
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
  var wrapper=fdjtDiv("#SBOOKPING.sbookping.hud");
  var iframe=fdjtNewElement("iframe","#SBOOKPINGFRAME");
  iframe.src="";
  iframe.hspace=0; iframe.vspace=0;
  iframe.marginHeight=0; iframe.marginWidth=0;
  iframe.border=0; iframe.frameBorder=0;
  fdjtAppend(wrapper,iframe);
  wrapper.onfocus=function (evt){
    iframe.src=
    sbook_podspot_uri(sbook_base,
		      sbook_head.id,
		      sbook_head.title||document.title||"",
		      false);};
  return wrapper
}

/* Displaying podspots */

function add_podspot(target,open)
{
  if (target.podspot) {
    if (open) {
      target.podspot.openIFrame();
      target.podspot.iframe.style.display='block';
      return target;}
    else return target.podspot;}
  else {
    var iframe_elt=null;
    var id=target.id;
    var anchor=document.createElement("a");
    var img=document.createElement('img');
    var title=target.getAttribute('title');
    var tribes=target.getAttribute('tribes');
    target.podspot=anchor;
    if (!(title)) {
      var head_info=
	sbook_getinfo(target)||
	sbook_getinfo(sbook_get_headelt(target));
      if ((head_info) && (head_info.title))
	title=head_info.title;}
    if (!(tribes)) tribes=[];
    if (typeof tribes === "string") tribes=tribes.split(';');
    else if ((tribes) && (tribes instanceof Array)) {}
    else tribes=[];
    var pclass=target.getAttribute('podspot_class');
    if (pclass==null) pclass=window.podspot_class;
    var iclass=target.getAttribute('podspot_iclass');
    if (iclass==null) iclass=window.podspot_iclass;
    var ptarget=target.getAttribute('podspot_target');
    if (ptarget==null) ptarget=window.podspot_target;
    if (ptarget==null) ptarget="_new";
    var base=target.getAttribute('podspot_base');
    if (base==null) base=window.podspot_base;
    var psize=target.getAttribute('podspot_size');
    if (psize==null) psize=window.podspot_size;
    var pstyle=target.getAttribute('podspot_style');
    if (pstyle==null) pstyle=window.podspot_style;
    var istyle=target.getAttribute('podspot_istyle');
    if (istyle==null) istyle=window.podspot_istyle;
    var base_uri="http://webechoes.net/sbooks/podspot.fdcgi?PODSPOT=yes";
    /* var base_uri="http://webechoes.net/app/ping?POPUP=yes"; */
    var href=base_uri+
      ((id) ? "&FRAG="+id : "")+
      ((title) ? "&TITLE="+title : "");
    var i=0; while (i<tribes.length) href=href+"&POD="+tribes[i++];
    if (window.getSelection())
      href=href+"&EXCERPT="+encodeURIComponent(window.getSelection());
    if (pclass==null) pclass="podspot";
    if (base==null) base="darkpodspot";
    if (psize==null) psize="32";
    if (ptarget==null) ptarget="overlay";
    anchor.href=href; anchor.className=pclass; 
    anchor.openIFrame=function() {
      if (anchor.iframe) return anchor.iframe;
      var iframe=document.createElement('iframe');
      iframe_elt=document.createElement('div');
      iframe.className="podspot";
      iframe.src=href+"&IFRAME=yes&DIALOG=yes";
      iframe.height="no";
      iframe_elt.appendChild(iframe);
      console.log('appending iframe to '+target);
      target.appendChild(iframe_elt);
      anchor.iframe=iframe;
      return iframe;}
    if (open) anchor.iframe=anchor.openIFrame();
    anchor.onclick=function() {
      if (iframe_elt)
	if (iframe_elt.style.display=='none')
	  iframe_elt.style.display='block';
	else iframe_elt.style.display='none';
      else anchor.openIFrame();
      anchor.blur();
      return false;};
    if (pstyle!=null) anchor.setAttribute('style',pstyle);
    img.src="http://webechoes.net/podspots/"+base+"_"+psize+"x"+psize+".png"
      +((id) ? ("?FRAG="+id) : "");
    img.className='podspot'; img.alt='podspot'; img.border=0; 
    anchor.appendChild(img);
    target.appendChild(anchor);
    return anchor;}
}

/* Searching echoes */

function sbook_search_echoes(query)
{
  var i=0; var results=false;
  while (i<query.length) {
    var q=query[i++];
    var echoes=sbook_echoes_by_tags[q]||(false);
    if (echoes)
      if (results)
	results=fdjtIntersect(results,echoes);
      else results=echoes;
    else {}}
  return results||[];
}


/* Invoking the iframe */

var sbook_echo_head=false;
var sbook_tribes=false;
function sbook_podspot_uri(uri,hash,title,tribes)
{
  var hashpos=uri.indexOf('#');
  fdjtTrace("Getting podspot for %s",uri);
  if ((hash) && (hashpos>=0))
    uri=uri.slice(0,hashpos)+'#'+hash;
  else if (hash) uri=uri+'#'+hash;
  var href=sbook_webechoes_root+"sbooks/podspot.fdcgi?"+
    "IFRAME=yes&PODSPOT=yes&DIALOG=yes";
  if (uri) href=href+"&URI="+encodeURIComponent(uri);
  if (title) href=href+"&TITLE="+encodeURIComponent(title);
  if (tribes) {
    if ((typeof tribes === "string") && (tribes.indexOf(';')>0))
      tribes=tribes.split(';');
    if (typeof tribes === "string")
      href=href+"&TRIBE="+encodeURIComponent(tribes);
    else if ((typeof tribes === "object") && (tribes instanceof Array)) {
      var i=0; while (i<tribes.length) 
		 href=href+"&TRIBE="+encodeURIComponent(tribes[i++]);}
    else fdjtWarn("Weird TRIBES argument for podspot %o",tribes);}
  return href;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
