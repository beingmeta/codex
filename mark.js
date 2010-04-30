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

/* Setting up the Mark hud for a particular target */

function sbookMarkHUDSetup(target,origin,excerpt)
{
  if (!(target))
    if ((origin)&&(origin.id))
      target=$ID(origin.id);
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
      $ID("SBOOKMARKOID").value=origin.oid;
      $ID("SBOOKMARKRELAY").value=glossinfo.relay||null;}
    else {
      $ID("SBOOKMARKOID").value=null;
      $ID("SBOOKMARKRELAY").value=origin.oid;}
  $ID("SBOOKMARKFORM").setAttribute('mode','tag');
  $ID("SBOOKMARKREFURI").value=refuri;
  $ID("SBOOKMARKFRAGID").value=target.id;
  $ID("SBOOKMARKSOURCE").value=sbookGetDocURI(target);
  $ID("SBOOKMARKSYNC").value=sbook_gloss_syncstamp;
  $ID("SBOOKMARKTITLE").value=
    ((origin)&&(origin.title))||
    ((target)&&(target===sbook_target)&&(sbook_target_title))||
    (sbook_get_titlepath(info))||"";
  if ((origin)&&(origin.oid))
    $ID("SBOOKMARKRELAY").value=origin.oid;
  else $ID("SBOOKMARKRELAY").value=null;
  var completions_elt=$ID("SBOOKMARKCLOUD");
  var cinfo=fdjtEltInfo(completions_elt);
  var completions=cinfo.allcompletions;
  // Uncheck all the completions
  if (completions._ischecked) {
    var cur=completions._ischecked;
    i=0; while (i<cur.length) {
      var c=cur[i++]; fdjtCheckSpan_update(c,false);}}
  if (glossinfo) {
    var newchecked=[];
    var i=0; while (i<completions.length) {
      var c=completions[i++];
      var val=c.value;
      if (tags.indexOf(val)>=0) {
	newchecked.push[c];
	fdjtCheckSpan_update(c,true);}}
    completions._ischecked=newchecked;}
  var seen_tags=[];
  var tags_elt=fdjtDOM("span.tagcues");
  $ID("SBOOKMARKTAGINPUT").value="";
  /* Figure out the tagcues */
  var tagcues=[];
  /* Get tags from the item and the items above it */
  {var scan=target; while (scan) {
      var glosses=sbook_glosses_by_id[scan.id];
      var info=sbookInfo(scan);
      /* Get the tags from the content */
      if ((info)&&(info.tags)&&(info.tags.length)) {
	var tags=info.tags; var i=0; var lim=tags.length;
	while (i<lim) fdjtInsert(tagcues,tags[i++]);}
      /* Get anyone else's tags for this item or its heads */
      if ((glosses) && (glosses.length)) {
	var i=0; var lim=glosses.length;
	while (i<lim) {
	  var tags=glosses[i++].tags;
	  var j=0; var jlim=tags.length;
	  while (j<jlim) fdjtInsert(tagcues,tags[j++]);}}
      scan=$ID(scan.sbook_headid);}}
  var tags=gather_tags(sbook_target);
  var k=0; while (k<tags.length) {
    var tag=tags[k++];
    if (fdjtIndexOf(tagcues,tag)<0) tagcues.push(tag);}
  // Set the selected text as an excerpt
  if ((excerpt)&&(excerpt.length>sbook_min_excerpt)) 
    sbookSetMarkExcerpt(excerpt);
  fdjtSetCompletionCues($ID("SBOOKMARKCLOUD"),tagcues);
  fdjtAutoPrompt_setup($ID("SBOOKMARK"));
  fdjtComplete($ID("SBOOKMARKTAGINPUT"));
  fdjtRedisplay($ID("SBOOKMARKFORM"));
  // fdjtTrace("tags_elt=%o tags_elt.input_elt=%o",tags_elt,tags_elt.input_elt);
  // fdjtComplete(tags_elt.input_elt);
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

  var detail_input=fdjtNewElement("TEXTAREA",".autoprompt#SBOOKMARKDETAIL");
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
  privyspan.onclick=fdjtCheckSpan_onclick;
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
  fdjtCheckSpan_setup(metastuff);
  fdjtAutoPrompt_setup(grid);
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
    fdjtCheckSpan_setup($ID("SBOOKMARKCLOUD"));
   win.sbookHUDMode(false);};
  // var hideicon=fdjtImage(sbicon("redx16x16.png"),"hideicon","x");
  // hideicon.onclick="fdjtDOM.addClass('SBOOKMARK','hidden')"; 
  var markdiv=fdjtDiv(classinfo||".mark",need_login,messages_elt,form);
  markdiv.sbookui=true;
  return markdiv;
}

function sbookMark_onsubmit(evt)
{
  if (($ID("SBOOKMARKINPUT").value)==="") {
    var id=$ID("SBOOKMARKFRAGID").value;
    var elt=$ID(id);
    var text=fdjtStdSpace(fdjtTextify(elt));
    fdjtTrace("Initializing text to %o from %o",text,elt);
    $ID("SBOOKMARKINPUT").value=
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
  taginput.completeopts=
    FDJT_COMPLETE_OPTIONS|FDJT_COMPLETE_ANYWORD|
    FDJT_COMPLETE_CLOUD;
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
  var checkspan=$ID("SBOOKMARKPRIVATE");
  var overlays=evt.target;
  var newfeed=evt.target.value;
  var info=sbookOIDs.map[newfeed];
  var checkstate;
  if (newfeed===':{}') checkstate=true;
  else if (newfeed===sbook_user) checkstate=false;
  else if ((info)&&(info.private)) checkstate=true;
  else checkstate=false;
  if (checkspan.tagName==='INPUT') checkspan.checked=checkstate;
  else fdjtCheckSpan_update(checkspan,checkstate);
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
  span1.onclick=fdjtCheckSpan_onclick;
  var a1=fdjtAnchor("http://sbooks.net/fb/settings/prefs",span2);
  a1.id="SBOOKCANTPOST";
  return new Array(span1,a1);
}

function sbookMarkOK()
{
  return fdjtInput("SUBMIT","ACTION","OK");
}


/* The completions element */

var _sbook_tag_completeopts=
  FDJT_COMPLETE_OPTIONS|FDJT_COMPLETE_ANYWORD|
  FDJT_COMPLETE_CLOUD;

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
  completions.onclick=sbookMarkCloud_onclick;
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
  var i=0; while (i<sbook_conversants.length) {
    var c=sbook_conversants[i++];
    fdjtDOM.addClass(sbookAddConversant(completions,c),"cue");}
  var i=0; while (i<sbook_user_dist.length) {
    var c=sbook_user_dist[i++];
    fdjtDOM.addClass(sbookAddConversant(completions,c),"cue");}
  var i=0; while (i<sbook_friends.length)
	     sbookAddConversant(completions,sbook_friends[i++]);
  var i=0; while (i<sbook_tribes.length)
	     sbookAddConversant(completions,sbook_tribes[i++]);
  if (sbook_friends) {
    var i=0; while (i<sbook_friends.length) 
	       sbookAddConversant(completions,sbook_friends[i++]);}
  fdjtInitCompletions(completions,false,_sbook_tag_completeopts);
  var maxmsg=fdjtDOM("div.maxcompletemsg",
		     "There are a lot ",
		     "(",fdjtDOM("span.completioncount","really"),")",
		     " of completions.  ");
  fdjtDOM.prepend(completions,maxmsg);
  return completions;
}

function sbookMarkCloud_onclick(evt)
{
  var target=FDJT$P(".checkspan",$T(evt));
  // fdjtCheckSpan_onclick(evt);
  if (target.getAttribute("ischecked"))
    $ID("SBOOKMARKTAGINPUT").value='';
}

function sbookAddConversant(completions,c,seen,checked,init)
{
  if (!(seen)) seen=completions._seen;
  if (seen[c]) return seen[c];
  var cinfo=sbookOIDs.map[c];
  var icon=false;
  if (cinfo.postable) 
    icon=fdjtImage("http://static.beingmeta.com/graphics/thumbtack19x15.png",
		   false,"@","postable");
  else if (cinfo.mailable) 
    icon=fdjtImage("http://static.beingmeta.com/graphics/envelope19x15.png",
		   false,"@","mailable");
  var cspan=sbookCompletionCheckspan("DIST",c,checked||false,cinfo.name,icon,cinfo.name);
  cspan.key=cinfo.name; cspan.value=c;
  seen[c]=cspan;
  // If the completions have a parent, we've already run the init, so
  // we need to call add completion to update the completion tables.
  if (completions.parentNode)
    fdjtAddCompletion(completions,cspan,_sbook_tag_completeopts);
  else fdjtDOM(completions,cspan," ");
  // fdjtTrace("Added conversant %o %o as %o under %o",c,cinfo,cspan,completions);
  return cspan;
}

function sbookCompletionCheckspan(varname,value,checked,key)
{
  var checkbox=fdjtInput("CHECKBOX",varname,value);
  var checkspan=fdjtDOM("span.checkspan.completion",checkbox);
  checkspan.key=key;
  if (arguments.length>4)
    fdjtAddElements(checkspan,arguments,4);
  else fdjtDOM(checkspan,key);
  if ((sbookOIDs.map[value]) && (sbookOIDs.map[value].summary))
    checkspan.title=sbookOIDs.map[value].gloss;
  if (checked) {
    checkspan.setAttribute("ischecked","yes");
    checkbox.checked=true;}
  else {checkbox.checked=false;}
  return checkspan;
}

function sbooksXRefs_onkeypress(evt)
{
  return fdjtMultiText_onkeypress(evt,'div');
}

function sbookSetMarkExcerpt(excerpt)
{
  var input=$ID("SBOOKMARKEXCERPT");
  var use_excerpt=excerpt;
  if ((excerpt)&&(excerpt.length<sbook_min_excerpt))
    excerpt=fdjtTextify(target,true);
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

function sbookMarkTagInput_onfocus(evt)
{
  var target=$T(evt);
  var markform=FDJT$P("form.mark",target);
  if (markform) {
    // markform.setAttribute("mode","tag");
    fdjtRedisplay(markform);}
  fdjtComplete_onfocus(evt);
}

function sbookMarkMode_onclick_handler(mode)
{
  return function(evt) {
    var pingbox=FDJT$P("FORM.mark",$T(evt));
    var curmode=pingbox.getAttribute('mode');
    if (mode)
      if (mode===curmode)
	pingbox.removeAttribute('mode');
      else pingbox.setAttribute('mode',mode);
    else pingbox.removeAttribute('mode');
    if (mode) {
      var inputid="SBOOKMARK"+mode.toUpperCase();
      if ($ID(inputid)) $ID(inputid).focus();}
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

function _sbook_tags_oncomplete(elt)
{
  fdjtCheckSpan_update(elt,true);
  var completions=FDJT$P(".completions",elt);
  var input_elt=((completions)&&(fdjt_get_completions_input(completions)));
  if (input_elt) {
    input_elt.value="";
    fdjtComplete(input_elt);
    fdjtAutoPrompt_setup(elt);}
}

function sbookMarkTag_onkeyup(evt)
{
  var target=$T(evt);
  var kc=evt.keyCode;
  if (fdjtString.isEmpty(evt.target.value)) return;
  else if ((kc===32)&&(evt.ctrlKey)) {
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
      fdjtDOM.prepend($ID("SBOOKMARKCLOUD"),knospan);
      target.value="";}
    evt.preventDefault(); evt.cancelBubble=true;
    return false;}
  else if ((kc===8)||(kc===9)) {
    setTimeout(function(evt){fdjtComplete(target);},100);}
}

/* Mark functions */

function sbookMark(target,gloss,excerpt)

{
  if (sbook_mark_target!==target) {$ID("SBOOKMARKFORM").reset();}
  if ((gloss)&&(gloss.user))
    // Handle relays and edits
    if (gloss.user===sbook_user)
      sbookMarkHUDSetup(target,gloss||false,excerpt||false);
    else {
      sbookMarkHUDSetup(target,false,excerpt||false);
      if (gloss.gloss) $ID("SBOOKMARKRELAY").value=gloss.gloss;
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
  $ID("SBOOKMARKINPUT").focus();
}

/* Creating login button */

function sbookCreateLoginButton(uri,image,title)
{
  var login_button=
    fdjtAnchor(((uri)?
		(uri+"?NEXT="+
		 encodeURIComponent("http://sbooks.net/app/read?URI="+encodeURIComponent(window.location.href))):
		"javascript:alert('sorry, not yet implemented'); return false;"),
	       fdjtImage(sbicon(image),"button"));
  fdjtDOM.addClass(login_button,"login");
  if (!(uri)) fdjtDOM.addClass(login_button,"disabled");
  login_button.title=((uri)?(title):("(coming soon) "+title));
  login_button.onclick=sbookLoginButton_onclick;
  return login_button;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*
/
