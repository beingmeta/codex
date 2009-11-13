/* -*- Mode: Javascript; -*- */

var sbooks_comment_id="$Id: social.js 4489 2009-11-08 00:41:06Z haase $";
var sbooks_comment_version=parseInt("$Revision: 4489 $".slice(10,-1));

/* This file implements comment dialogs */


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

/* Making the PING hud */

function sbookCreatePingHUD()
{
  var relay_block=fdjtDiv(".sbookrelayblock#SBOOKPINGRELAYBLOCK");
  var msg=fdjtInput("TEXT","MSG","",".autoprompt#SBOOKPINGINPUT");
  // Bind lexically, for the closure below, just in case
  var win=window;
  msg.prompt="What do you think?";
  msg.onfocus=sbookPing_onfocus;
  var id_elt=fdjtInput("HIDDEN","FRAGID","","#SBOOKPINGFRAGID");
  var uri_elt=fdjtInput("HIDDEN","URI","","#SBOOKPINGURI");
  var src_elt=fdjtInput("HIDDEN","SRC","","#SBOOKPINGSRC");
  var title_elt=fdjtInput("HIDDEN","TITLE","","#SBOOKPINGTITLE");
  var relay_elt=fdjtInput("HIDDEN","RELAY","","#SBOOKPINGRELAY");
  var echo_elt=fdjtInput("HIDDEN","ECHO","","#SBOOKPINGECHO");
  var sync_input=
    fdjtInput("HIDDEN","SYNC","","#SBOOKPINGSYNC");
  var user_elt=fdjtInput("HIDDEN","WE/USER",sbook_user,"#SBOOKPINGUSER");
  msg.setAttribute("autocomplete","off");
  var detail_input=fdjtNewElement("TEXTAREA",".autoprompt#SBOOKPINGDETAIL");
  var detail_elt=
    fdjtDiv(".detail.pingtab",
	    fdjtImage(sbook_graphics_root+"detailsicon32x32.png","head",
		      "details"),
	    fdjtDiv("content",detail_input));
  detail_input.name="DETAIL";
  detail_input.prompt="Enter detailed comments";
  var need_login=
    ((sbook_user)?(false):
     (fdjtDiv("needlogin",
	      "You most login (",
	      sbookCreateLoginButton
	      ("http://sbooks.net/fb/auth",
	       "facebook_32.png","login through facebook"),
	      ") to make comments")));
  var excerpt_input=
    fdjtNewElement("TEXTAREA",".autoprompt#SBOOKPINGEXCERPT");
  var excerpt_elt=
    fdjtDiv(".excerpt.pingtab",
	    fdjtImage(sbook_graphics_root+"scissorsicon32x32.png","head",
		      "excerpt"),
	    fdjtDiv("content",excerpt_input));
  excerpt_input.name="EXCERPT";
  excerpt_input.prompt="Add an excerpt";
  var xrefs_input=fdjtInput("TEXT","XREFS","","xref");
  var xrefs_elt=
    fdjtDiv(".xrefs.pingtab",
	    fdjtImage(sbook_graphics_root+"outlink32x32.png","head","REFS"),
	    fdjtDiv("content",xrefs_input));
  xrefs_input.onkeypress=function(evt) {
    return fdjtMultiText_onkeypress(evt,'div');};
  var messages_elt=
    fdjtDiv("messages",
	    fdjtDiv(".message.pinging","pinging...."),
	    fdjtDiv(".message.echoing","echoing!"));
  // Specifying the .tags class causes the tags tab to be open by default 
 var form=fdjtNewElement("FORM","#SBOOKPINGFORM.ping",
			 id_elt,uri_elt,src_elt,title_elt,relay_elt,echo_elt,
			 sync_input,user_elt,
			 messages_elt,relay_block,
			 fdjtDiv("#PINGMSG",msg),
			 sbookExtrasElement(),
			 sbookCompletionsElement(),
			 detail_elt,excerpt_elt,xrefs_elt);
  form.setAttribute("accept-charset","UTF-8");
  form.ajaxuri=sbook_ping_uri;
  form.jsonpuri=sbook_jsonping_uri;
  form.synchronous=true;
  form.action="http://"+sbook_server+"/echoes/ping.fdcgi";
  form.target="sbookping";
  form.onclick=sbookPingForm_onclick;
  fdjtAutoPrompt_setup(form);
  // form.windowopts="width=500,height=400";
  form.onsubmit=
    ((sbook_user)?(fdjtForm_onsubmit):(sbookNoUserSubmit));
  form.oncallback=function(req) {
    if (sbook_debug_network)
      fdjtLog("Got AJAX echo response %o from %o",req,sbook_ping_uri);
    sbookImportEchoes(JSON.parse(req.responseText));
    fdjtDropClass(form,"submitting");
    /*
    fdjtAddClass("SBOOKPINGFORM","echoing");
    setTimeout(function() {
	fdjtDropClass("SBOOKPINGFORM","echoing");
	form.reset();
	sbookHUDMode(false);},
      1500);
    */
    form.reset();
    fdjtCheckSpan_setup($("SBOOKPINGCOMPLETIONS"));
    win.sbookHUDMode(false);};
  return fdjtDiv
    (".ping", /* .hudblock.hud */
     need_login,
     fdjtImage((sbook_user_img)||
	       (sbook_graphics_root+"remarkballoon50x50.png"),
	       "#SBOOKUSERIMG.floatleft",""),
     form);
}

function sbookPingHUDSetup(origin)
{
  var target;
  if (!(origin))
    target=origin=sbook_focus;
  else if (origin.fragid)
    target=$(origin.fragid);
  else target=origin;
  if (sbook_ping_target===target) {
    if (sbook_target!==target) sbookSetTarget(target);
    var excerpt=window.getSelection();
    if ((excerpt)&&(!(fdjtIsEmptyString(excerpt))))
      $("SBOOKPINGEXCERPT").value=excerpt;
    return;}
  sbookSetTarget(target);
  if ((target.title) && (target.title!=='live comment')) {
    target.sbookoldtitle=target.title;
    target.title='live comment: '+target.title;}
  else target.title='live comment';
  sbook_ping_target=target;
  var info=((target) &&
	    ((target.sbookinfo)||
	     ((target.sbook_head) && (target.sbook_head.sbookinfo))));
  $("SBOOKPINGFORM").setAttribute('mode','tag');
  $("SBOOKPINGURI").value=sbook_geturi(target);
  $("SBOOKPINGSRC").value=sbook_getsrc(target);
  $("SBOOKPINGSYNC").value=sbook_echo_syncstamp;
  $("SBOOKPINGTITLE").value=
    (origin.title)||(target.title)||(sbook_get_titlepath(info));
  if (origin.echo)
    if (origin.echo.user===sbook_user) {
      $("SBOOKPINGRELAY").value="";
      $("SBOOKPINGECHO").value=(origin.echo);}
    else {
      $("SBOOKPINGRELAY").value=(origin.echo);
      $("SBOOKPINGECHO").value="";}
  else {
    $("SBOOKPINGRELAY").value="";
    $("SBOOKPINGECHO").value="";}
  if ((origin) && (origin.echo)) {
    var completions_elt=$("SBOOKPINGCOMPLETIONS");
    var completions=completions_elt.allcompletions;
    var dist=origin.echo.dist||[];
    var tags=origin.echo.tags||[];
    var newchecked=[];
    var i=0; while (i<completions.length) {
      var val=completions[i].value;
      if (dist.indexOf(val)>=0) newchecked.push(completions[i++]);
      else if (tags.indexOf(val)>=0) newchecked.push(completions[i++]);
      else i++;}
    var cur=completions._ischecked||[];
    i=0; while (i<newchecked.length) {
      var n=newchecked[i++];
      if (cur.indexOf(n)<0) fdjtCheckSpan_update(n,true);}
    i=0; while (i<cur.length) {
      var c=cur[i++];
      if (cur.indexOf(n)<0) fdjtCheckSpan_update(n,false);}
    completions._ischecked=newchecked;}
  var seen_tags=[];
  var tags_elt=fdjtSpan(".tagcues");
  {var excerpt=window.getSelection();
    if ((excerpt)&&(!(fdjtIsEmptyString(excerpt))))
      $("SBOOKPINGEXCERPT").value=excerpt;
    $("SBOOKPINGEXCERPT").removeAttribute("isempty");}
  $("SBOOKPINGTAGINPUT").value="";
  var seen_tags=[];
  /* Get the tags from all the echoes */
  {var i=0; while (i<sbook_allechoes.length) 
	      if (sbook_allechoes[i].fragid===target.id) {
		var echo=sbook_allechoes[i++];
		if (echo.tags) {
		  var tags=echo.tags; var j=0; while (j<tags.length) {
		    var tag=tags[j++];
		    if (fdjtIndexOf(seen_tags,tag)<0) seen_tags.push(tag);}}}
	      else i++;}
  /* Get the tags from the content */
  var tags=gather_tags(sbook_focus);
  var k=0; while (k<tags.length) {
    var tag=tags[k++];
    if (fdjtIndexOf(seen_tags,tag)<0) seen_tags.push(tag);}
  fdjtSetCompletionCues($("SBOOKPINGCOMPLETIONS"),seen_tags);
  fdjtAutoPrompt_setup($("SBOOKPING"));
  sbookSelectEchoes(sbookEchoesHUD,true,false,target.id);
  fdjtComplete($("SBOOKPINGTAGINPUT"));
  fdjtRedisplay($("SBOOKPINGFORM"));
  // fdjtTrace("tags_elt=%o tags_elt.input_elt=%o",tags_elt,tags_elt.input_elt);
  // fdjtComplete(tags_elt.input_elt);
}

/* sbook extras */

var pingmode_pat=/(detail)|(excerpt)|(xrefs)/g;

function sbookExtrasElement()
{
  var controls=sbookPingControls();
  var taginput=fdjtInput("TEXT","TAGS","","#SBOOKPINGTAGINPUT");
  var tagicon_uri=sbook_graphics_root+"TagIcon32x32.png";
  taginput.setAttribute("COMPLETIONS","SBOOKPINGCOMPLETIONS");
  taginput.setAttribute("autocomplete","off");
  taginput.completeopts=
    FDJT_COMPLETE_OPTIONS|FDJT_COMPLETE_ANYWHERE|
    FDJT_COMPLETE_CLOUD;
  taginput.onkeyup=sbookPingTag_onkeyup;
  taginput.onkeypress=fdjtComplete_onkey;
  taginput.oncomplete=_sbook_tags_oncomplete;
  taginput.enterchars=[-13,59];
  taginput.onfocus=function(evt){
    var target=$T(evt);
    var pingform=$P("form.ping",target);
    if (pingform) {
      pingform.setAttribute("mode","tag");
      fdjtRedisplay(pingform);}
    fdjtComplete_onfocus(evt);};
  return fdjtDiv(".extras",controls,
		 fdjtImage(tagicon_uri,"head","TAGS"),taginput);
}

function sbookPingControls()
{
  var save_button=fdjtInput("SUBMIT","ACTION","save");
  var post_button=fdjtInput("SUBMIT","ACTION","post");
  var tags_button=
    fdjtImage(sbook_graphics_root+"TagIcon16x16.png","button","tags",
	      "add or edit descriptive tags");
  var detail_button=
    fdjtImage(sbook_graphics_root+"detailsicon16x16.png","button","detail",
	      "add extended comments");
  var excerpt_button=
    fdjtImage(sbook_graphics_root+"scissorsicon16x16.png","button","excerpt",
	      "add or edit an excerpt");
  var xrefs_button=
    fdjtImage(sbook_graphics_root+"outlink16x16.png","button","xrefs",
	      "add or edit external references");
  tags_button.onclick=sbookPingMode_onclick_handler("tag");
  detail_button.onclick=sbookPingMode_onclick_handler("detail");
  excerpt_button.onclick=sbookPingMode_onclick_handler("excerpt");
  xrefs_button.onclick=sbookPingMode_onclick_handler("xrefs");
  if (!(sbook_user_canpost)) {
    post_button.disabled=true;
    post_button.title='you need to enable posting for your account';}
  else {
    post_button.title='post this comment to configured feeds';}
  return fdjtSpan("buttons",
		  tags_button,detail_button,excerpt_button,xrefs_button,
		  sbookExposureElement(),
		  save_button,post_button);
}

function sbookExposureElement()
{
  var friendly_option=fdjtNewElement("OPTION",false,"friends");
  friendly_option.value='friendstoo'; friendly_option.selected=true;
  friendly_option.title='share this with my friends and any tribes I tag';
  var justfriends_option=fdjtNewElement("OPTION",false,"just friends");
  justfriends_option.title='just share this with my friends';
  justfriends_option.value='justfriends';
  var nofriends_option=fdjtNewElement("OPTION",false,"no friends");
  nofriends_option.value='nofriends';
  nofriends_option.title="just share this with the tribes or people I tag";
  var private_option=fdjtNewElement("OPTION",false,"private");
  private_option.title="don't share this anyone else";
  private_option.value='private';
  var exposure_elt=
    fdjtNewElement("SELECT",false,
		   friendly_option,justfriends_option,
		   nofriends_option,private_option);
  exposure_elt.name='exposure';
  return exposure_elt;
}

var _sbook_tag_completeopts=
  FDJT_COMPLETE_OPTIONS|FDJT_COMPLETE_ANYWHERE|
  FDJT_COMPLETE_CLOUD;

function sbookCompletionsElement()
{
  var seen={};
  var completions=
    fdjtDiv(".completions.checkspans.pingtab#SBOOKPINGCOMPLETIONS");
  completions._seen=seen;
  completions.onclick=fdjtCheckSpan_onclick;
  var i=0; while (i<sbook_conversants.length) {
    var c=sbook_conversants[i++];
    fdjtAddClass(sbookAddConversant(completions,c),"cue");}
  var i=0; while (i<sbook_user_dist.length) {
    var c=sbook_user_dist[i++];
    fdjtAddClass(sbookAddConversant(completions,c),"cue");}
  var i=0; while (i<sbook_friends.length)
	     sbookAddConversant(completions,sbook_friends[i++]);
  var i=0; while (i<sbook_tribes.length)
	     sbookAddConversant(completions,sbook_tribes[i++]);
  var alltags=sbook_index._all;
  var i=0; while (i<alltags.length) {
    var tag=alltags[i++];
    if ((tag.length>0)&&(tag[0]==="\u00A7")) continue;
    fdjtAppend(completions,
	       knoCheckCompletion("TAGS",Knowde(tag),false)," ");}
  fdjtInitCompletions(completions,false,_sbook_tag_completeopts);
  return completions;
}

function sbookAddConversant(completions,c,seen,checked,init)
{
  if (!(seen)) seen=completions._seen;
  if (seen[c]) return seen[c];
  var cinfo=social_info[c];
  var cspan=sbookCompletionCheckspan("DIST",c,checked||false,cinfo.name);
  cspan.key=cinfo.name; cspan.value=c;
  seen[c]=cspan;
  // If the completions have a parent, we've already run the init, so
  // we need to call add completion to update the completion tables.
  if (completions.parentNode)
    fdjtAddCompletion(completions,cspan,_sbook_tag_completeopts);
  else fdjtAppend(completions,cspan," ");
  // fdjtTrace("Added conversant %o %o as %o under %o",c,cinfo,cspan,completions);
  return cspan;
}

function sbookCompletionCheckspan(varname,value,checked,key)
{
  var checkbox=fdjtInput("CHECKBOX",varname,value);
  var checkspan=fdjtSpan(".checkspan.completion",checkbox);
  checkspan.key=key;
  if (arguments.length>4)
    fdjtAppend(checkspan,arguments,4);
  else fdjtAppend(checkspan,key);
  if ((social_info[value]) && (social_info[value].summary))
    checkspan.title=social_info[value].gloss;
  if (checked) {
    checkspan.setAttribute("ischecked","yes");
    checkbox.checked=true;}
  else {checkbox.checked=false;}
  return checkspan;
}

/* Handlers */

function sbookPingMode_onclick_handler(mode)
{
  return function(evt) {
    var pingbox=$P("FORM.ping",$T(evt));
    var curmode=pingbox.getAttribute('mode');
    if (mode)
      if (mode===curmode)
	pingbox.removeAttribute('mode');
      else pingbox.setAttribute('mode',mode);
    else pingbox.removeAttribute('mode');
    if (mode) {
      var inputid="SBOOKPING"+mode.toUpperCase();
      if ($(inputid)) $(inputid).focus();}
    pingbox.className=pingbox.className;}
}

function sbookPing_onfocus(evt)
{
  sbookHUDMode("ping");
  sbookPingHUDSetup(false);
  fdjtAutoPrompt_onfocus(evt);
}

function sbookNoUserSubmit(evt)
{
  alert('You must be logged in to make a comment');
  evt.cancelBubble=true; evt.preventDefault();
}

function sbookPingForm_onclick(evt)
{
  evt.cancelBubble=true;
}

function _sbook_tags_oncomplete(elt)
{
  fdjtCheckSpan_update(elt,true);
  var completions=$P(".completions",elt);
  if ((completions)&&(completions.input_elt))
    completions.input_elt.value="";
}

function sbookPingTag_onkeyup(evt)
{
  var target=$T(evt);
  var kc=evt.keyCode;
  if ((kc===32)&&(evt.ctrlKey)) {
    var completions=fdjtComplete(evt.target);
    var strings=completions.strings;
    if (strings.length===1) {
      evt.preventDefault();
      evt.cancelBubble=true;
      evt.target.value=strings[0];}
    else if (strings.length===0) {}
    else {
      var prefix=fdjtCommonPrefix(strings[0],strings[1],false,true);
      var i=2; while ((prefix) && (i<strings.length))
		 prefix=fdjtCommonPrefix(prefix,strings[i++],false,true);
      evt.preventDefault();
      evt.cancelBubble=true;
      if (prefix) evt.target.value=prefix;}}
  else if (kc===13) {
    if (!(fdjtForceComplete(target))) {
      var curval=target.value;
      var knospan=knoCheckCompletion("TAGS",curval,true);
      fdjtPrepend($("SBOOKPINGCOMPLETIONS"),knospan);
      target.value="";}
    evt.preventDefault(); evt.cancelBubble=true;
    return false;}
  else if ((kc===8)||(kc===9)) {
    setTimeout(function(evt){fdjtComplete(target);},100);}
}

/* Callbacks */

function sbookNewEchoes(echoes,winarg)
{
  /* For when called from the iframe bridge */
  var win=winarg||window;
  sbookImportEchoes(echoes);
  var form=win.document.getElementById("SBOOKPINGFORM");
  fdjtDropClass(form,"submitting");
  // fdjtAddClass("SBOOKPINGFORM","echoing");
  /*
  setTimeout(function() {
      fdjtDropClass("SBOOKPINGFORM","echoing");
      $("SBOOKPINGFORM").reset();
      sbookHUDMode(false);},
    1500);
  */
  form.reset();
  fdjtCheckSpan_setup($("SBOOKPINGCOMPLETIONS"));
  win.sbookHUDMode(false);
}

function sbookJSONPechoes(echoes)
{
  if (sbook_debug_network) fdjtLog("Got new echoes (probably) from JSONP call");
  sbookNewEchoes(echoes);
}


/* Dead code */

function sbookSelectTribe()
{
  var friendly_option=fdjtNewElement("OPTION",false,"friends");
  friendly_option.value='friendstoo'; friendly_option.selected=true;
  var private_option=fdjtNewElement("OPTION",false,"private");
  private_option.value='nofriends';
  var notribe_option=
    fdjtNewElement("OPTION",false,"No additional tribe");
  notribe_option.value=":{}"; notribe_option.selected=true;
  var select_elt=fdjtNewElement("SELECT",false,notribe_option);
  select_elt.name="TRIBE"; select_elt.value=":{}";
  /*
  var i=0; while (i<tribal_oids.length) {
    var tribe=tribal_oids[i++]; var info=social_info[tribe];
    var option=fdjtNewElement("OPTION",false,info.name);
    option.value=tribe; if (info.gloss) option.title=info.gloss;
    fdjtAppend(select_elt,option);}
  */
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
