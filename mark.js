/* -*- Mode: Javascript; -*- */

/* This file implements dialogs and interaction for marking (adding
   glosses) to sbooks. */

var sbooks_glossmark_id="$Id$";
var sbooks_glossmark_version=parseInt("$Revision$".slice(10,-1));

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

// This is the target for which the mark HUD has been set
var sbook_mark_target=false;
var sbook_trace_gloss=false;

// This is the completions object for the mark cloud
var sbook_mark_cloud=false;

/* Setting up the Mark hud for a particular target */

function sbookMarkHUDSetup(target,origin,excerpt)
{
  if (!(target))
    if ((origin)&&(origin.id))
      target=fdjtID(origin.id);
    else target=sbook_target;
  var refuri=sbookGetRefURI(target);
  if (sbook_trace_gloss)
    fdjtLog("Setting up gloss HUD for %o from %o st=%o excerpt=%o",
	    target,origin,sbook_target,excerpt);
  if (sbook_mark_target===target) {
    /* If the HUD is already, initialized for the target, just update
       the excerpt */
    if (sbook_trace_gloss)
      fdjtLog("Just updating gloss HUD with excerpt %o",excerpt);
    if ((excerpt)&&(excerpt.length>sbook_min_excerpt))
      sbookSetMarkExcerpt(excerpt);
    return;}
  sbook_mark_target=target;
  var info=((target) &&
	    ((sbookInfo(target)) ||
	     (sbookInfo(sbookGetHead(target)))));
  // Get information about the origin if it's a gloss
  //  If it's the user's gloss, we set it.  Otherwise,
  //   we set the relay field
  var glossinfo=((origin)&&(origin.oid)&&sbookOIDs.map[origin.oid]);
  if (glossinfo)
    if (glossinfo.user===sbook_user) {
      fdjtID("SBOOKMARKOID").value=origin.oid;
      fdjtID("SBOOKMARKRELAY").value=glossinfo.relay||null;}
    else {
      fdjtID("SBOOKMARKOID").value=null;
      fdjtID("SBOOKMARKRELAY").value=origin.oid;}
  fdjtID("SBOOKMARKFORM").setAttribute('mode','tag');
  fdjtID("SBOOKMARKREFURI").value=refuri;
  fdjtID("SBOOKMARKFRAGID").value=target.id;
  fdjtID("SBOOKMARKSOURCE").value=sbookGetDocURI(target);
  fdjtID("SBOOKMARKSYNC").value=sbook_gloss_syncstamp;
  fdjtID("SBOOKMARKTITLE").value=
    ((origin)&&(origin.title))||
    ((target)&&(target===sbook_target)&&(sbook_target_title))||
    (sbook_get_titlepath(info))||"";
  if ((origin)&&(origin.oid))
    fdjtID("SBOOKMARKRELAY").value=origin.oid;
  else fdjtID("SBOOKMARKRELAY").value=null;
  var completions_elt=fdjtID("SBOOKMARKCLOUD");
  // Uncheck all the completions
  var checked=fdjtDOM.getChildren(completions_elt,".checked");
  var i=0; var lim=checked.length;
  while (i<lim) fdjtUI.CheckSpan.set(checked[i++],false);
  if ((glossinfo)&&(glossinfo.tags)) {
    var byval=sbook_mark_cloud.byval;
    var tags=glossinfo.tags;
    i=0; lim=tags.length;
    while (i<lim) {
      var c=byval[tags[i++]];
      if (c) fdjtUI.CheckSpan.set(c,true);}}
  fdjtID("SBOOKMARKTAGINPUT").value="";
  /* Figure out the tagcues */
  var tagcues=[];
  /* Get tags from the item and the items above it */
  {var info=sbook_info[target.id]; while (info) {
      var glosses=sbook_glosses_by_id[info.frag];
      /* Get the tags from the content */
      if ((info)&&(info.tags)&&(info.tags.length)) {
	var tags=info.tags; var i=0; var lim=tags.length;
	while (i<lim) tagcues.concat(tags[i++]);}
      /* Get anyone else's tags for this item or its heads */
      if ((glosses) && (glosses.length)) {
	var i=0; var lim=glosses.length;
	while (i<lim) {
	  var tags=glosses[i++].tags;
	  var j=0; var jlim=tags.length;
	  while (j<jlim) fdjtInsert(tagcues,tags[j++]);}}
      info=info.head;}}
  // Set the selected text as an excerpt
  if ((excerpt)&&(excerpt.length>sbook_min_excerpt)) 
    sbookSetMarkExcerpt(excerpt);
  sbook_mark_cloud.setCues(tagcues);
  fdjtUI.AutoPrompt.setup(fdjtID("SBOOKMARK"));
}

/* Making the MARK hud */

function sbookCreateMarkHUD(classinfo)
{
  // Bind lexically, for the closure below, just in case
  var win=window;
  /* Hidden elements */
  var id_elt=fdjtInput("HIDDEN","FRAGID","","#SBOOKMARKFRAGID");
  var oid_elt=fdjtInput("HIDDEN","OID",null,"#SBOOKMARKOID");
  var uri_elt=fdjtInput("HIDDEN","REFURI","","#SBOOKMARKREFURI");
  var title_elt=fdjtInput("HIDDEN","TITLE","","#SBOOKMARKTITLE");
  var relay_elt=fdjtInput("HIDDEN","RELAY","","#SBOOKMARKRELAY");
  var source_elt=fdjtInput("HIDDEN","SOURCE","","#SBOOKMARKSOURCE");
  var excerpt_elt=fdjtInput("HIDDEN","EXCERPT","","#SBOOKMARKEXCERPT");
  var sync_input=fdjtInput("HIDDEN","SYNC","","#SBOOKMARKSYNC");
  var user_elt=fdjtInput("HIDDEN","USER",sbook_user,"#SBOOKMARKUSER");
  var doctitle_elt=
    ((document.title)&&(fdjtInput("HIDDEN","DOCTITLE",document.title)));

  var image_uri=(sbook_user_img)||(sbicon("remarkballoon50x50.png"));
  
  var relay_block=fdjtDOM("div.sbookrelayblock#SBOOKMARKRELAYBLOCK");
  var msg_input=fdjtInput("TEXT","MSG","",".autoprompt#SBOOKMARKINPUT");
  msg_input.setAttribute("autocomplete","off");
  msg_input.setAttribute("colspan","2");
  msg_input.prompt="What do you think?";
  msg_input.onfocus=sbookMark_onfocus;

  var detail_input=fdjtDOM("TEXTAREA.autoprompt#SBOOKMARKDETAIL");
  var detail_elt=
    fdjtDOM("div.detail.marktab",
	    // fdjtImage(sbicon("detailsicon32x32.png"),"head","details"),
	    fdjtDOM("div.content",detail_input));
  detail_input.name="DETAIL";
  detail_input.prompt="Enter detailed comments";

  var xrefs_input=fdjtInput("TEXT","XREFS","",".xref.autoprompt");
  xrefs_input.setAttribute("prompt","enter external URLs");
  var xrefs_elt=
    fdjtDOM("div.xrefs.marktab",
	    // fdjtImage(sbicon("outlink32x32.png"),"head","REFS"),
	    fdjtDOM("div.content",xrefs_input));
  xrefs_input.onkeypress=sbooksXRefs_onkeypress;

  var login_button=((sbook_user)?(false):(fdjtDOM("span.loginbutton","login")));
  if (login_button) {
    login_button.title="click to login to sBooks";
    login_button.onclick=sbookLoginButton_onclick;}
  var need_login=
    ((login_button)&&
     (fdjtDOM("div.needlogin","You must ",login_button," to add your own glosses")));
  var messages_elt=fdjtDOM("div.messages");
  
  var privy=fdjtInput("CHECKBOX","private","yes");
  var privyspan=fdjtDOM("span.checkspan",privy,"private");
  privy.checked=false;
  privy.id="SBOOKMARKPRIVATE";
  privyspan.title="private: don't share this with my personal circle";
  privy_span.addEventListener
    ("click",fdjtUI.Checkspan.onclick,false);
  var metastuff=
    fdjtDOM("div.metastuff",
	    fdjtDOM("div.controls",sbookMarkPickFeed(),privyspan),
	    fdjtDOM("div.buttons",
		    fdjtInput("SUBMIT","ACTION","Save","#SBOOKMARKSAVEACTION",
			      "Save (mark) this gloss to the server"),
		    " ",fdjtInput("SUBMIT","ACTION","Push","#SBOOKMARKPUSHACTION",
				  "Save this gloss and publish it to any enabled overlays/walls/etc")));
  var grid=
    fdjtDOM("div.markform",
	    fdjtDOM("div.lhs",fdjtImage(image_uri,"#SBOOKMARKIMAGE.userpic"),
		    fdjtDOM("div.controls",sbookMarkControls()),
		    fdjtImage(sbicon("detailsicon32x32.png"),"head","detail"),
		    fdjtImage(sbicon("outlink48x48.png"),"head","xrefs"),
		    fdjtImage(sbicon("TagIcon32x32.png"),"head","tags")),
	    fdjtDOM("div.msg",msg_input),
	    metastuff,sbookMarkTagTab(),detail_elt,xrefs_elt);
  
  // Specifying the .tag class causes the tags tab to be open by default 
  var form=fdjtElt("FORM#SBOOKMARKFORM.mark.tag",
		   fdjtDOM("div.hidden",id_elt,uri_elt,source_elt,title_elt,
			   excerpt_elt,relay_elt,oid_elt,sync_input,user_elt,
			   doctitle_elt),
		   fdjtDOM("div#SBOOKSHOWEXCERPT.excerpt"),relay_block,
		   grid);
  form.setAttribute("accept-charset","UTF-8");
  form.ajaxuri=sbook_mark_uri;
  form.jsonpuri=sbook_jsonping_uri;
  form.synchronous=true;
  form.action="http://"+sbook_server+"/sbook/glossmark.fdcgi";
  form.target="sbookping";
  form.onclick=sbookMarkForm_onclick;
  fdjtUI.CheckSpan.setup(metastuff);
  fdjtUI.AutoPrompt.setup(grid);
  // form.windowopts="width=500,height=400";
  form.onsubmit=
    ((sbook_user)?(sbookMark_onsubmit):(sbookNoUserSubmit));
  form.oncallback=function(req) {
    if (sbook_trace_network)
      fdjtLog("Got AJAX gloss response %o from %o",req,sbook_mark_uri);
    sbookImportGlosses(JSON.parse(req.responseText));
    fdjtDOM.dropClass(form,"submitting");
    /* Turn off the target lock */
    sbookSetTarget(false);
    form.reset();
    fdjtID("SBOOKMARKCLOUD").addEventListener
    ("click",fdjtUI.Checkspan.onclick,false);
   win.sbookHUDMode(false);};
  // var hideicon=fdjtImage(sbicon("redx16x16.png"),"hideicon","x");
  // hideicon.onclick="fdjtDOM.addClass('SBOOKMARK','hidden')"; 
  var markdiv=fdjtDOM(classinfo||"div.mark",need_login,messages_elt,form);
  markdiv.sbookui=true;
  return markdiv;
}

function sbookMark_onsubmit(evt)
{
  if ((fdjtID("SBOOKMARKINPUT").value)==="") {
    var id=fdjtID("SBOOKMARKFRAGID").value;
    var elt=fdjtID(id);
    var text=fdjtString.stdspace(fdjtDOM.textify(elt));
    fdjtTrace("Initializing text to %o from %o",text,elt);
    fdjtID("SBOOKMARKINPUT").value=
      ((text.length>60)?((text.slice(0,60))+"..."):(text));}
  return fdjtForm_onsubmit(evt);
}

/* Mark form design elements */

var pingmode_pat=/(detail)|(excerpt)|(xrefs)/g;

function sbookMarkTagInput()
{
  var taginput=fdjtInput("TEXT","TAGS","","#SBOOKMARKTAGINPUT.autoprompt");
  taginput.setAttribute("COMPLETIONS","SBOOKMARKCLOUD");
  taginput.setAttribute("PROMPT","enter tags, groups, or friends");
  taginput.setAttribute("autocomplete","off");
  taginput.onkeyup=sbookMarkTag_onkeyup;
  taginput.onkeypress=fdjtComplete_onkey;
  taginput.oncomplete=_sbook_tags_oncomplete;
  taginput.enterchars=[-13,59];
  taginput.onfocus=sbookMarkTagInput_onfocus;
  taginput.onblur=fdjtAutoPrompt_onblur;
  return fdjtDOM("div.taginput",taginput);
}

function sbookMarkPickFeed()
{
  var private_option=fdjtElt("OPTION","Just me");
  var friendly_option=
    fdjtElt("OPTION#SBOOKFRIENDLYOPTION","My friends (personal circle)");
  var pickfeed=fdjtElt
    ("SELECT#SBOOKMARKOPTIONS",private_option,friendly_option);
  pickfeed.name='FEED';
  private_option.value=":{}";
  friendly_option.value=sbook_user;
  friendly_option.selected=true; friendly_option.defaultSelected=true;
  var i=0; var len=sbook_overlays.length;
  pickfeed.onchange=sbookMarkFeed_onchange;
  pickfeed.title="The primary 'audience' for this gloss";
  return pickfeed;
}

function sbookMarkFeed_onchange(evt)
{
  var checkspan=fdjtID("SBOOKMARKPRIVATE");
  var overlays=evt.target;
  var newfeed=evt.target.value;
  var info=sbookOIDs.map[newfeed];
  var checkstate;
  if (newfeed===':{}') checkstate=true;
  else if (newfeed===sbook_user) checkstate=false;
  else if ((info)&&(info.private)) checkstate=true;
  else checkstate=false;
  if (checkspan.tagName==='INPUT') checkspan.checked=checkstate;
  else fdjtUI.CheckSpan.set(checkspan,checkstate);
}

function sbookMarkControls()
{
  var tags_button=
    fdjtImage(sbicon("TagIcon16x16.png"),"button","tags",
	      "add or edit descriptive tags");
  var detail_button=
    fdjtImage(sbicon("detailsicon16x16.png"),"button","detail",
	      "add extended comments");
  var xrefs_button=
    fdjtImage(sbicon("outlink16x16.png"),"button","xrefs",
	      "add or edit external references");
  tags_button.onclick=sbookMarkMode_onclick_handler("tag");
  detail_button.onclick=sbookMarkMode_onclick_handler("detail");
  xrefs_button.onclick=sbookMarkMode_onclick_handler("xrefs");
  return new Array(tags_button,detail_button,xrefs_button);
}

function sbookMarkPush()
{
  var check1=fdjtInput("CHECKBOX","PUSH","yes",false);
  var check2=fdjtInput("CHECKBOX","PUSH","yes",false);
  check2.disabled=true;
  var span1=fdjtDOM("span.checkspan#SBOOKCANPOST","push",check1);
  var span2=fdjtDOM("span.checkspan","push",check2);
  span1.onclick=fdjtUI.Checkspan.onclick;
  var a1=fdjtDOM.Anchor("A","http://sbooks.net/fb/settings/prefs",span2);
  a1.id="SBOOKCANTPOST";
  return new Array(span1,a1);
}

function sbookMarkOK()
{
  return fdjtInput("SUBMIT","ACTION","OK");
}


/* The completions element */

function sbookMarkTagTab()
{
  var seen={};
  var completions=fdjtDOM("div.completions.checkspans#SBOOKMARKCLOUD");
  return fdjtDOM("div.marktab.tags",sbookMarkTagInput(),completions);
}

function sbookMarkCloud()
{
  var seen={};
  var completions=fdjtDOM("div.completions.checkspans");
  completions._seen=seen;
  completions.onclick=fdjtUI.CheckSpan.onclick;
  var tagscores=sbookTagScores();
  var alltags=tagscores._all;
  var i=0; while (i<alltags.length) {
    var tag=alltags[i++];
    // We elide sectional tags
    if ((typeof tag === "string") && (tag[0]==="\u00A7")) continue;
    var tagnode=knoCheckCompletion("TAGS",tag,false,document.knowlet||false);
    fdjtDOM(completions, tagnode," ");}
  var i=0; while (i<alltags.length) {
    var tag=alltags[i++];
    // We elide sectional tags
    if ((typeof tag === "string") && (tag[0]==="\u00A7")) {
      var showname=tag; var title;
      if (showname.length>17) {
	showname=showname.slice(0,17)+"...";
	title=tag;}
      var sectnode=fdjtDOM("span.completion.checkspan",
			    fdjtInput("CHECKBOX","TAGS",tag),
			    fdjtDOM("span.sectname",showname));
      if (title) sectnode.title=title;
      sectnode.key=tag; sectnode.value=tag;
      fdjtDOM(completions,sectnode," ");
      continue;}}
  var maxmsg=fdjtDOM("div.maxcompletemsg",
		     "There are a lot ",
		     "(",fdjtDOM("span.completioncount","really"),")",
		     " of completions.  ");
  fdjtDOM.prepend(completions,maxmsg);
  sbook_mark_cloud=new fdjtUI.Completions(completions);
  return completions;
}

function _sbook_tags_oncomplete(elt)
{
  fdjtUI.CheckSpan.set(elt,true);
  var completions=fdjtDOM.getParent(elt,".completions");
  var input_elt=((completions)&&(fdjt_get_completions_input(completions)));
  if (input_elt) {
    input_elt.value="";
    fdjtComplete(input_elt);
    fdjtUI.AutoPrompt.setup(elt);}
}

var _sbook_tagupdate=false;

function sbookTagInput_onkeypress(evt)
{
  evt=evt||event||null;
  if (_sbook_tagupdate) {
    clearTimeout(_sbook_tagupdate);
    _sbook_tagupdate=false;}
  var ch=evt.charCode; var kc=evt.keyCode;
  var target=fdjtDOM.T(evt);
  if ((ch===13)||(ch===59)) {
    var qstring=target.value;
    if (!(fdjtString.isEmpty(qstring))) {
      var completions=sbook_mark_cloud.complete(qstring);
      if (completions.length) 
	fdjtUI.CheckSpan.set(completions[0],true);
      else {
	var curval=target.value;
	var knospan=knoCheckCompletion("TAGS",curval,true);
	fdjtDOM.prepend(fdjtID("SBOOKMARKCLOUD"),knospan);
	sbook_mark_cloud.addCompletion(curval);}
      target.value="";
      fdjtDOM.addClass(target,"isempty");
      sbook_mark_cloud.complete("");}
    else {}
    fdjtDOM.cancel(evt);
    return false;}
  else if (ch==32) { /* Space */
    var qstring=target.value;
    var completions=sbook_mark_cloud.complete(qstring);
    if (completions.prefix!==qstring) {
      target.value=completions.prefix;
      fdjtDOM.cancel(evt);
      return;}}
  else {
    _sbook_tagupdate=
      setTimeout(function(target){
	  _sbook_tagupdate=false;
	  sbook_mark_cloud.complete(target.value);},
	_sbook_searchupdate_delay,target);}
}

function sbookTagInput_onfocus(evt)
{
  evt=evt||event||null;
  var input=fdjtDOM.T(evt);
  sbook_mark_cloud.complete(input.value);
}

function sbookTagInput_onkeyup(evt)
{
  evt=evt||event||null;
  var kc=evt.keyCode;
  if ((kc===8)||(kc===45)) {
    if (_sbook_tagupdate) {
      clearTimeout(_sbook_tagupdate);
      _sbook_tagupdate=false;}
    var target=fdjtDOM.T(evt);
    _sbook_tagupdate=
      setTimeout(function(target){
	  _sbook_tagupdate=false;
	  sbook_mark_cloud.complete(target.value);},
	_sbook_searchupdate_delay,target);}
}

/* Other fields */

function sbooksXRefs_onkeypress(evt)
{
  return fdjtMultiText_onkeypress(evt,'div');
}

function sbookSetMarkExcerpt(excerpt)
{
  var input=fdjtID("SBOOKMARKEXCERPT");
  var use_excerpt=excerpt;
  if ((excerpt)&&(excerpt.length<sbook_min_excerpt))
    excerpt=fdjtDOM.textify(target,true);
  else if ((excerpt)&&(sbook_max_excerpt)&&(excerpt.length>sbook_max_excerpt))
    excerpt=excerpt.slice(0,sbook_max_excerpt);
  if (excerpt) {
    excerpt=fdjtStringTrim(excerpt);
    input.value=excerpt;
    fdjtDOM.replace("SBOOKSHOWEXCERPT",
		fdjtDOM("div.excerpt",
			fdjtDOM("span.lq","\u201c"),fdjtDOM("span.rq","\u201d"),
			fdjtDOM("div.text",excerpt.replace(/\n+/g," \u2016 "))));}
  else {
    input.value="";
    fdjtDOM.replace("SBOOKSHOWEXCERPT",fdjtDOM("div.noexcerpt"));}
}

/* Handlers */

function sbookMarkMode_onclick_handler(mode)
{
  return function(evt) {
    var pingbox=fdjtDOM.getParent(fdjtDOM.T(evt),"FORM.mark");
    var curmode=pingbox.getAttribute('mode');
    if (mode)
      if (mode===curmode)
	pingbox.removeAttribute('mode');
      else pingbox.setAttribute('mode',mode);
    else pingbox.removeAttribute('mode');
    if (mode) {
      var inputid="SBOOKMARK"+mode.toUpperCase();
      if (fdjtID(inputid)) fdjtID(inputid).focus();}
    pingbox.className=pingbox.className;}
}

function sbookMark_onfocus(evt)
{
  sbookMarkHUDSetup(false);
  fdjtAutoPrompt_onfocus(evt);
  fdjtDOM.dropClass("SBOOKMARKFORM","closed");
}

function sbookNoUserSubmit(evt)
{
  alert('You must be logged in to make a comment');
  evt.cancelBubble=true; evt.preventDefault();
}

function sbookMarkForm_onclick(evt)
{
  evt.cancelBubble=true;
}


/* Mark functions */

function sbookMark(target,gloss,excerpt)

{
  if (sbook_mark_target!==target) {fdjtID("SBOOKMARKFORM").reset();}
  if ((gloss)&&(gloss.user))
    // Handle relays and edits
    if (gloss.user===sbook_user)
      sbookMarkHUDSetup(target,gloss||false,excerpt||false);
    else {
      sbookMarkHUDSetup(target,false,excerpt||false);
      if (gloss.gloss) fdjtID("SBOOKMARKRELAY").value=gloss.gloss;
      if (gloss.user) {
	var userinfo=sbookOIDs.map[gloss.user];
	var glossblock=
	  fdjtDOM("div.sbookrelayblock","Relayed from ",
		  fdjtDOM("span.user",userinfo.name),
		  ((gloss.msg)&&(": ")),
		  ((gloss.msg)?(fdjtDOM("span.msg",gloss.msg)):(false)));
	fdjtDOM.replace("SBOOKMARKRELAYBLOCK",glossblock);}}
  else sbookMarkHUDSetup(target,gloss||false,excerpt||false);
  sbookOpenGlossmark(target,true);
  sbookHUDMode("mark");
  fdjtID("SBOOKMARKINPUT").focus();
}

/* Creating login button */

function sbookCreateLoginButton(uri,image,title)
{
  var login_button=
    fdjtDOM.Anchor
    ("A",((uri)?
	  (uri+"?NEXT="+
	   encodeURIComponent("http://sbooks.net/app/read?URI="+
			      encodeURIComponent(window.location.href))):
	  "javascript:alert('sorry, not yet implemented'); return false;"),
     fdjtImage(sbicon(image),"button"));
  fdjtDOM.addClass(login_button,"login");
  if (!(uri)) fdjtDOM.addClass(login_button,"disabled");
  login_button.title=((uri)?(title):("(coming soon) "+title));
  login_button.onclick=sbookLoginButton_onclick;
  return login_button;
}

function sbookSetupMarkHUD(hud)
{
  var input=fdjtID("SBOOKMARKTAGINPUT");
  input.addEventListener("keypress",sbookTagInput_onkeypress);
  input.addEventListener("keyup",sbookTagInput_onkeyup);
  input.addEventListener("focus",sbookTagInput_onfocus);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*
/
