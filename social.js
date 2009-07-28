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
var social_oids=[];
var social_info={};
var sbook_echoes_by_pingid={};
var sbook_echoes_by_user={};
var sbook_echoes_by_tag={};
var sbook_echoes_by_xtag={};
var sbook_echoes_by_tribe={};
var sbook_echoes_by_id={};

var sbook_echo_remark_icon=
  "http://static.beingmeta.com/graphics/remarkballoon16x13.png";
var sbook_echo_more_icon=
  "http://static.beingmeta.com/graphics/Asterisk16x16.png";
var sbook_echo_eye_icon=
  "http://static.beingmeta.com/graphics/EyeIcon20x16.png";

/* Social UI components */


function sbookAllEchoesDiv()
{
  var results_div=fdjtDiv("#SBOOKECHOES.sbooksummaries.hud");
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
      ((sources.indexOf) && (sources.indexOf(echo.user)>=0)) ||
      ((sources.indexOf) && (echo.tribes) &&
       (fdjtOverlaps(echo.tribes,sources)))) &&
     ((!(idroot)) ||
      ((echo.fragid) && (echo.fragid.search(idroot)===0))));
}

function sbookSelectEchoes(results_div,sources,native,idroot)
{
  if (typeof native === "undefined")
    native=((sources===false) || (sources.length===0));
  var blocks=$$(".tocblock",results_div);
  var i=0; while (i<blocks.length) {
    var block=blocks[i++];  var empty=true;
    var summaries=$$(".summary",block);
    var j=0; while (j<summaries.length) {
      var summary=summaries[j++];
      var echo=summary.sbookecho;
      if (echo)
	if (((sources===true) ||
	     ((sources.indexOf) && (sources.indexOf(echo.user)>=0)) ||
	     ((sources.indexOf) && (echo.tribes) &&
	      (fdjtOverlaps(echo.tribes,sources)))) &&
	    ((!(idroot)) ||
	     ((echo.fragid) && (echo.fragid.search(idroot)===0)))) {
	  fdjtDropClass(summary,"hidden"); empty=false;}
	else fdjtAddClass(summary,"hidden");
      else if (native) {
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
    users.push(echo.user);}
  return users;
}

function sbookEchoBar_onclick(evt)
{
  var target=evt.target;
  var echobar=$P(".echobar",target);
  var sources=((echobar) && (echobar.sbooksources))||[];
  if (!(echobar)) return; /* Warning? */
  if (evt.shiftKey) 
    if (sources.indexOf(target.oid)>=0) {
      sources.splice(sources.indexOf(target.oid),1);
      fdjtDropClass(target,"selected");}
    else {
      fdjtAddClass(target,"selected");
      sources.push(target.oid);}
  else sources=new Array(target.oid);
  echobar.sbooksources=sources;
  if (!(sbook_mode)) {
    sbookSelectEchoes($("SBOOKECHOES"),sources);
    sbookHUDMode("echoes");}
  else if (sbook_mode==="echoes")
    sbookSelectEchoes($("SBOOKECHOES"),sources);
  else if (sbook_mode==="browsing") 
    sbookSelectEchoes($("SBOOKSUMMARIES"),sources);
  else if (sbook_mode==="searching") {
    sbookShowSearch(sbook_query);
    sbookSelectEchoes($("SBOOKSUMMARIES"),sources);
    sbookHUDMode("browsing");}
  else sbookSelectEchoes($("SBOOKSUMMARIES"),sources);
  evt.preventDefault(); evt.cancelBubble=true;
}

function sbookSetSources(echobar,sources)
{
  var children=echobar.childNodes;
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (child.nodeType===1) {
      if ((sources.indexOf(child.oid)>=0) ||
	  (fdjtOverlaps(sources,child.oid)))
	fdjtAddClass(child,"sourced");
      else fdjtDropClass(child,"sourced");}}
}

function sbookCreateEchoBar(classinfo,oids)
{
  if (!(oids)) oids=social_oids;
  if (!(classinfo)) classinfo="echobar";
  var ping_button=
    fdjtImage("http://static.beingmeta.com/graphics/remarkballoon32x25.png",
	      "button ping","add a comment");
  var everyone_button=
    fdjtImage("http://static.beingmeta.com/graphics/sBooksWE_2_32x32.png",
	      "button everyone","everyone");
  var echobar=fdjtDiv(classinfo," ",everyone_button);
  var socialelts=[]; var echoelts=[];
  var i=0; while (i<oids.length) {
    var oid=oids[i++];
    var info=social_info[oid];
    var img=fdjtImage(info.squarepic,"social",info.name);
    img.oid=oid; img.name=info.name;
    if (info.summary) img.title=info.summary;
    else img.title=info.name;
    socialelts.push(img);
    fdjtAppend(echobar,img);}
  everyone_button.onclick=function(evt) {
    if ((sbook_mode==="echoes")||(sbook_mode==="ping")) {
      sbookHUDMode(false);
      evt.cancelBubble=true;
      return;}
    var sources=true;
    echobar.sbooksources=sources;
    sbookSelectEchoes($("SBOOKECHOES"),sources);
    sbookHUDMode("echoes");
    evt.cancelBubble=true;};
  echobar.onclick=sbookEchoBar_onclick;
  ping_button.id="SBOOKPINGBUTTON";
  ping_button.onclick=function(evt) {
    if (sbook_mode==="ping")
      sbookHUDMode(false);
    else sbookHUDMode("ping");
    $("SBOOKPINGINPUT").focus();
    evt.target.blur();
    evt.cancelBubble=true;
    evt.preventDefault();};
  fdjtAppend(echobar,ping_button);
  return echobar;
}

function sbookSetEchoes(echoes)
{
  // fdjtTrace("sbookSetEchoes %o",echoes);
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
  var social_count=0;
  var socialelts=sbookHUDechoes.socialelts;
  i=0; while (i<socialelts.length) {
    var socialelt=socialelts[i++];
    if (social.indexOf(socialelt.oid)>=0) {
      socialelt.setAttribute("displayed","yes");
      social_count++;}
    else socialelt.setAttribute("displayed","no");}
  if (social_count)
    fdjtSwapClass(sbookHUDsocial,"empty","filled");
  else fdjtSwapClass(sbookHUDsocial,"filled","empty");
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
  entry.onmouseover=function(evt) {
    sbookPreview(target,true);};
  entry.onmouseout=function(evt) {
    fdjtScrollRestore();
    window.setTimeout("sbook_preview=false;",100);};
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
      fdjtDelayHandler(300,sbookSetPreview,true,document.body,"preview");};
    eye.onmouseout=function(evt){
      fdjtDelayHandler(300,sbookSetPreview,false,document.body,"preview");};}
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
  if (typeof tags === "string") tags=new Array(tags);
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

/* Making the PING hud */

function sbookCreatePingHUD()
{
  var msg=fdjtInput("TEXT","MSG","",".autoprompt#SBOOKPINGINPUT");
  var id_elt=fdjtInput("HIDDEN","FRAGID","","#SBOOKPINGFRAGID");
  var uri_elt=fdjtInput("HIDDEN","URI","","#SBOOKPINGURI");
  var tags_elt=fdjtDiv(".tags#SBOOKPINGTAGS");
  var title_elt=fdjtInput("HIDDEN","TITLE","","#SBOOKPINGTITLE");
  var pingid_elt=fdjtInput("HIDDEN","PINGID","","#SBOOKPINGID");
  var tribes_elt=fdjtDiv(".tribes#SBOOKPINGTRIBES");
  var details_input=fdjtNewElement("TEXTAREA",".autoprompt#SBOOKPINGDETAILS");
  var details_elt=fdjtDiv("detail",fdjtDiv("head","Detail"),details_input);
  var excerpt_input=fdjtNewElement("TEXTAREA",".autoprompt#SBOOKPINGEXCERPT");
  var excerpt_elt=fdjtDiv("excerpt",fdjtDiv("head","Excerpt"),excerpt_input);
  var xrefs_input=fdjtInput("TEXT","XREF","","xref");
  var xrefs_elt=fdjtDiv("xrefs",
			fdjtDiv("head","External references"),
			xrefs_input);
  var form=fdjtNewElement("FORM","#SBOOKPINGFORM.pingform",
			  id_elt,uri_elt,title_elt,pingid_elt,
			  fdjtDiv("controls",sbookPingControls(),msg),
			  tags_elt,tribes_elt,details_elt,excerpt_elt,
			  xrefs_elt);
  msg.prompt="What do you think?";
  details_input.prompt="Enter detailed comments";
  excerpt_input.prompt="Add an excerpt";
  details_elt.name="DETAILS"; excerpt_elt.name="EXCERPT";
  xrefs_input.onkeypress=function(evt) {
    return fdjtMultiText_onkeypress(evt,'div');};
  msg.onfocus=sbookPing_onfocus;
  form.action="http://webechoes.net/ping.fdcgi";
  form.target="_new";
  fdjtAutoPrompt_setup(form);
  // form.onsubmit=sbookPing_onsubmit;
  return fdjtDiv(".ping.hud",form);
}

var sbook_ping_target=false;

function sbookPingHUDSetup(origin)
{
  var target;
  if (!(origin)) target=origin=sbook_focus;
  else if (origin.fragid)
    target=$(origin.fragid);
  else target=origin;
  if (sbook_ping_target===target) return;
  sbook_ping_target=target;
  var info=((target) &&
	    ((target.sbookinfo)||
	     ((target.sbook_head) && (target.sbook_head.sbookinfo))));
  $("SBOOKPINGURI").value=sbook_base;
  $("SBOOKPINGFRAGID").value=target.id;
  $("SBOOKPINGTITLE").value=
    (origin.title)||(target.title)||(sbook_get_titlepath(info));
  if (origin.pingid)
    $("SBOOKPINGID").value=(origin.pingid);
  else $("SBOOKPINGID").value="";
  var seen_tags=[];
  var tags_elt=sbookPingTags();
  {var i=0; while (i<sbook_allechoes.length) 
	      if (sbook_allechoes[i].fragid===target.id) {
		var echo=sbook_allechoes[i++];
		if (echo.tags) {
		  var tags=echo.tags; var j=0; while (j<tags.length) {
		    var tag=tags[j++];
		    if (seen_tags.indexOf(tag)<0) {
		      seen_tags.push(tag);
		      fdjtAppend(tags_elt,sbookTagCheckspan(tag,false)," ");}}}}
	      else i++;}
  var tags=gather_tags(sbook_focus);
  var k=0; while (k<tags.length) {
    var tag=tags[k++];
    if (seen_tags.indexOf(tag)<0) {
      seen_tags.push(tag);
      fdjtAppend(tags_elt,sbookTagCheckspan(tag,false)," ");}}
  /* Insert all the user's tags */
  {var i=0; while (i<sbook_allechoes.length) 
	      if (sbook_allechoes[i].fragid===target.id) {
		var echo=sbook_allechoes[i++];
		if (echo.user===sbook_user) {
		  var tags=echo.tags; var j=0; while (j<tags.length) {
		    var tag=tags[j++];
		    if (seen_tags.indexOf(tag)<0) {
		      seen_tags.push(tag);
		      fdjtAppend(tags_elt,sbookTagCheckspan(tag,false)," ");}}}}
	      else i++;}
  tags_elt.onclick=fdjtCheckSpan_onclick;
  fdjtReplace("SBOOKPINGTAGS",tags_elt);
  // fdjtTrace("tags_elt=%o tags_elt.input_elt=%o",tags_elt,tags_elt.input_elt);
  // fdjtComplete(tags_elt.input_elt);
}

function sbookPingMode_onclick_handler(mode)
{
  return function(evt) {
    var pingbox=$P(".pingform",evt.target);
    if (fdjtHasClass(pingbox,mode))
      fdjtDropClass(pingbox,mode);
    else fdjtSwapClass(pingbox,pingmode_pat,mode);};
}

var pingmode_pat=/(detail)|(excerpt)|(xrefs)/g;

function sbookPingControls()
{
  var go_button=
    fdjtNewElement("BUTTON",".gobutton",
		   fdjtImage(sbook_graphics_root+"remarkballoon24x19.png",
			     "button","go"));
  var details_button=
    fdjtImage(sbook_graphics_root+"detailsicon16x16.png","button","details");
  var excerpt_button=
    fdjtImage(sbook_graphics_root+"scissorsicon16x16.png","button","excerpt");
  var xrefs_button=
    fdjtImage(sbook_graphics_root+"outlink16x16.png","button","xrefs");
  details_button.title="add extended comments";
  details_button.onclick=sbookPingMode_onclick_handler("detail");
  details_button.title="add/edit excerpt";
  excerpt_button.onclick=sbookPingMode_onclick_handler("excerpt");
  details_button.title="add/edit external references";
  xrefs_button.onclick=sbookPingMode_onclick_handler("xrefs");
  go_button.name="ACTION"; go_button.value="SAVE";
  return fdjtSpan("buttons",details_button,excerpt_button,xrefs_button,
		  go_button);
}

function sbookPingTags()
{
  var div=fdjtDiv(".tags",input,fdjtSpan("head","TAGS"));
  div.onclick=fdjtCheckSpan_onclick;
  return div;
  // This is for if we're doing completion over the tags
  fdjtAddClass(div,"completions");
  var input=fdjtInput("TEXT","TAGTERM","");
  input.onkeypress=fdjtComplete_onkey;
  input.completions_elt=div;
  div.input_elt=input;
  input.completeopts=
    FDJT_COMPLETE_OPTIONS|FDJT_COMPLETE_ANYWHERE|
    FDJT_COMPLETE_CLOUD|FDJT_COMPLETE_SHOWEMPTY;
  return div;
}

function sbookTagCheckspan(tag,checked,varname)
{
  if (!varname) varname="TAG";
  var checkbox=fdjtInput("CHECKBOX",varname,tag);
  var checkspan=fdjtSpan(".checkspan.completion",checkbox,knoDTermSpan(tag));
  checkspan.key=tag;
  if (checked) {
    checkspan.setAttribute("ischecked","yes");
    checkbox.checked=true;}
  else {checkbox.checked=false;}
  return checkspan;
}

fdjt_trace_completion=true;

function sbookPing_onfocus(evt)
{
  sbookPingHUDSetup(evt.target);
  fdjtAutoPrompt_onfocus(evt);
}

/* The Echoes/Social Database */

function importSocialData(data)
{
  if (!(data))
    if (typeof sbook_echoes_data === "undefined") {
      fdjtLog("No social data available");
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
	item.sortkey=pingid;
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

function gather_tags(elt,results)
{
  if (!(results)) results=[];
  var tags=elt.tags;
  if ((tags) && (tags.length>0)) {
    var i=0; while (i<tags.length) results.push(tags[i++]);}
  if (elt.parentNode) gather_tags(elt.parentNode,results);
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
  var href="http://webechoes.net/qricon.fdcgi?"+
    "URI="+encodeURIComponent(sbook_base)+
    ((id)?("&FRAG="+id):"")+
    ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
  var i=0; while (i<tribes.length) href=href+"&TRIBES="+tribes[i++];
  i=0; while (i<tags.length) href=href+"&TAGCUE="+tags[i++];
  var sources=sbookGetSourcesUnder(id);
  var imgsrc="http://static.beingmeta.com/graphics/sBooksWE_2_32x32.png";
  if ((sources.length===1) &&
      (social_info[sources[0]].squarepic))
    imgsrc=social_info[sources[0]].squarepic||imgsrc;
  var podspot=fdjtSpan
    ("podspot",fdjtImage(href,"qricon"),fdjtImage(imgsrc,"podimg","podspot"));
  podspot.onclick=function(evt){
    if (sbook_mode==="echoes") {
      sbookHUDMode(false); return;}
    if (evt.shiftKey)
      sbookSelectEchoes(sbookEchoesHUD,$("SBOOKECHOBAR").sbooksources,false,id);
    else sbookSelectEchoes(sbookEchoesHUD,true,false,id);
    sbookHUDMode("echoes");
    evt.preventDefault(); evt.cancelBubble=true;};
  target.podspot=podspot;
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
    var next=((info.sbook_head) && ((info.sbook_head.sbookinfo)||false));
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
