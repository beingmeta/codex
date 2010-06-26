/* -*- Mode: Javascript; -*- */

/* This file implements dialogs and interaction for marking (adding
   glosses) to sbooks. */

/* Copyright (C) 2009-2010 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
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

var sbooks_glossmark_id="$Id$";
var sbooks_glossmark_version=parseInt("$Revision$".slice(10,-1));

var sbookMark=
    (function(){
	var markmodes=/(showxrefs)|(showhelp)|(showattach)/;

	// This is the target for which the mark HUD has been set
	sbook.mark_target=false;
	// This is the gloss being edited
	sbook.mark_gloss=false;
	
	// This is the completions object for the mark cloud
	var sbook_mark_cloud=false;
	
	function inputvalue(elt){
	    if (fdjtDOM.hasClass(elt,"isempty"))
		return "";
	    else return elt.value;}

	function get_titlepath(info,embedded){
	    if (!(info))
		if (document.title)
		    if (embedded)
			return " // "+document.title;
	    else return "";
	    else return "";
	    else {
		var next=(info.head)||false;
		if (info.title)
		    return ((embedded) ? (" // ") : (""))+info.title+
		    get_titlepath(next,true);
		else return get_titlepath(next,embedded);}}

	/* Setting up the mark hud for a particular target */
	function setupHUD(target,origin,excerpt){
	    if (!(target))
		if ((origin)&&(origin.id))
		    target=fdjtID(origin.id);
	    else target=sbook.target;
	    if (!(sbook_mark_cloud))
		fdjtDOM.replace("SBOOKMARKCLOUD",sbookMark.getCloud().dom);
	    var refuri=sbook.getRefURI(target);
	    if (sbook.Trace.mark)
		fdjtLog("Setting up gloss HUD for %o from %o st=%o excerpt=%o",
			target,origin,sbook.target,excerpt);
	    if ((sbook.mark_target===target)&&
		((origin===sbook.mark_origin)||
		 ((!(origin))&&(!(sbook.mark_origin))))) {
		/* If the HUD is already, initialized for the target, just update
		   the excerpt from the current selection */
		if (sbook.Trace.mark)
		    fdjtLog("Just updating gloss HUD with excerpt %o",excerpt);
		// Make sure there's a UUID
		if (!(fdjtID("SBOOKMARKUUID").value))
		    fdjtID("SBOOKMARKUUID").value=
		    fdjtState.getUUID(sbook.nodeid);
		if (typeof excerpt != 'undefined')
		    setExcerpt(fdjtID("SBOOKMARKFORM"),
			       excerpt||((origin)&&(origin.excerpt))||false);
		return;}
	    sbook.mark_target=target;
	    var info=((target) &&
		      ((sbook.Info(target)) ||
		       (sbook.Info(sbook.getHead(target)))));
	    // Get information about the origin if it's a gloss
	    //  If it's the user's gloss, we set it.  Otherwise,
	    //   we set the relay field
	    if (origin)
		if (origin.user===sbook.user) {
		    fdjtID("SBOOKMARKUUID").value=origin.qid;
		    fdjtID("SBOOKMARKRELAY").value=origin.relay||null;}
	    else {
		fdjtID("SBOOKMARKUUID").value=null;
		fdjtID("SBOOKMARKRELAY").value=origin.qid;}
	    fdjtID("SBOOKMARKREFURI").value=refuri;
	    fdjtID("SBOOKMARKFRAGID").value=target.id;
	    fdjtID("SBOOKMARKSOURCE").value=sbook.getDocURI(target);
	    fdjtID("SBOOKMARKSYNC").value=sbook.syncstamp;
	    fdjtID("SBOOKMARKUUID").value=
		((origin)&&(origin.qid))||(fdjtState.getUUID(sbook.nodeid));
	    fdjtID("SBOOKMARKTITLE").value=
		((origin)&&(origin.title))||
		((target)&&(target===sbook.target)&&(sbook.target_title))||
		(get_titlepath(info))||"";
	    if ((origin)&&(origin.oid))
		fdjtID("SBOOKMARKRELAY").value=origin.oid;
	    else fdjtID("SBOOKMARKRELAY").value=null;
	    if (origin)
		fdjtID("SBOOKMARKINPUT").value=origin.note;
	    setExcerpt(fdjtID("SBOOKMARKFORM"),
		       excerpt||((origin)&&(origin.excerpt))||false);
	    var tags_elt=fdjtID("SBOOKMARKTAGS");
	    var checkspans=fdjtDOM.getChildren(tags_elt,".checkspan");
	    fdjtDOM.remove(fdjtDOM.toArray(checkspans));
	    if ((origin)&&(origin.tags)) {
		var tags=origin.tags;
		i=0; lim=tags.length;
		while (i<lim) addTag(tags_elt,tags[i++]);}
	    if ((origin)&&(origin.xrefs))
		setXRefs(fdjtID("SBOOKMARKFORM"),(origin.xrefs));
	    if ((origin)&&(origin.attachments))
		setAttachments(fdjtID("SBOOKMARKFORM"),(origin.attachments));
	    // Reinit the autoprompt fields
	    fdjtUI.AutoPrompt.setup(fdjtID("SBOOKMARKHUD"));
	    /* Figure out the tagcues */
	    setTagCues(sbook_mark_cloud,target);}
	
	function setTagCues(cloud,target){
	    var docinfo=sbook.docinfo[target.id];
	    var glosses=sbook.glosses.find('frag',target.id);
	    if (cloud.frag_cues) fdjtDOM.dropClass(cloud.frag_cues,"cue");
	    var tags=[].concat(docinfo.tags||[]);
	    if ((glosses)&&(glosses.length)) {
		var i=0; var lim=glosses.length;
		while (i<lim) {
		    var gloss=glosses[i++];
		    if (gloss.tags) cues.concat(gloss.tags);}}
	    cloud.frag_cues=cloud.setCues(tags);}

	function setExcerpt(form,text){
	    var excerpt=fdjtDOM.getChild(form,'.excerpt');
	    var content=(excerpt)&&fdjtDOM.getChild(excerpt,'.content');
	    var input=(excerpt)&&
		fdjtDOM.getChild(excerpt,"input[name='EXCERPT']");	    
	    if (!(text)) {
		input.value="";
		fdjtDOM.replace(content,fdjtDOM("span.content"));
		fdjtDOM.addClass(excerpt,"noexcerpt");}
	    else {
		input.value=text;
		fdjtDOM.dropClass(excerpt,"noexcerpt");
		fdjtDOM.replace(content,fdjtDOM("span.content",text));}}
	function setXRefs(form,xrefs){
	    var div=fdjtDOM.getChild(form,'.xrefs');
	    var cur=fdjtDOM.getChildren(div,'.xref');
	    if ((cur)&&(cur.length)) fdjtDOM.remove(cur);
	    if (xrefs) 
		for (var uri in xrefs) {
		    var title=xrefs[uri];
		    var compound=((uri===title)?(uri):(uri+"|"+title));
		    var xref_div=
			fdjtDOM("div.xref",
				fdjtUI.CheckSpan
				("span.checkspan.checkbox",
				 "XREF",compound,true),
				fdjtDOM.Anchor(false,uri,title));
		    fdjtDOM(div,xref_div);}}
	function setAttachments(form,attachments){
	    var div=fdjtDOM.getChild(form,'.attachments');
	    var cur=fdjtDOM.getChildren(div,'.attachment');
	    if ((cur)&&(cur.length)) fdjtDOM.remove(cur);
	    if (attachments) 
		for (var uri in attachments) {
		    var title=attachments[uri];
		    var compound=((uri===title)?(uri):(uri+"|"+title));
		    var xref_div=
			fdjtDOM("div.attachment",
				fdjtUI.CheckSpan
				("span.checkspan.checkbox",
				 "ATTACHMENTS",compound,true),
				fdjtDOM.Anchor(false,uri,title));
		    fdjtDOM(div,xref_div);}}

	function oncallback(req){
	    if (sbook.Trace.network)
		fdjtLog("Got AJAX gloss response %o from %o",req,sbook_mark_uri);
	    fdjtKB.Import(JSON.parse(req.responseText));
	    // Clear the UUID
	    fdjtID("SBOOKMARKUUID").value="";
	    sbook.preview_target=false;
	    /* Turn off the target lock */
	    sbook.setTarget(false);
	    sbookMode(false);}

	function addTag(form,tag) {
	    if (!(tag)) tag=form;
	    if (form.tagName!=='FORM')
		form=fdjtDOM.getParent(form,'form')||form;
	    var tagselt=fdjtDOM.getChild(form,'.tags');
	    var varname='TAGS'; var info; var title=false;
	    if ((tag.nodeType)&&(fdjtDOM.hasClass(tag,'completion'))) {
		if (fdjtDOM.hasClass(tag,'outlet'))
		    varname='OUTLETS';
		else if (fdjtDOM.hasClass(tag,'source'))
		    varname='ATTENTION'
		else {}
		if (tag.title) title=tag.title;
		tag=sbook_mark_cloud.getValue(tag);}
	    var info=fdjtKB.ref(tag)||sbook.knodule.probe(tag);
	    var text=((info)?
		      ((info.toHTML)&&(info.toHTML())||info.name||info.dterm):
		      (tag));
	    if (info) {
		if (info.knodule===sbook.knodule)
		    tag=info.dterm;
		else tag=info.qid||info.oid||info.dterm||tag;}
	    if ((info)&&(info.pool===sbook.sourcekb)) varname='OUTLETS';
	    var span=fdjtUI.CheckSpan("span.checkspan",varname,tag,true);
	    if (title) span.title=title;
	    fdjtDOM.addClass(span,varname.toLowerCase());
	    fdjtDOM.append(span,text);
	    fdjtDOM.append(tagselt,span," ");}

	    
	/* The completions element */
	function getCloud(){
	    if (sbook_mark_cloud) return sbook_mark_cloud;
	    var seen={};
	    var sbook_index=sbook.index;
	    var outlets_span=fdjtDOM("span.outlets");
	    var sources_span=fdjtDOM("span.sources");
	    var completions=fdjtDOM("div.completions","\n",outlets_span);
	    if (sbook.outlets) {
		var outlets=sbook.outlets;
		var i=0; var lim=outlets.length;
		while (i<lim) {
		    var outlet=outlets[i++];
		    var info=sbook.sourcekb.ref(outlet);
		    var completion=fdjtDOM("span.completion.cue.outlet",info.name);
		    completion.setAttribute("value",outlet);
		    completion.setAttribute("key",info.name);
		    if (info.about) completion.title=
			"share with '"+info.about+"'";
		    fdjtDOM(outlets_span,completion," ");}}
	    if (sbook.sources) {
		var outlets=sbook.outlets||[];
		var sources=sbook.sources;
		var i=0; var lim=sources.length;
		while (i<lim) {
		    var source=sources[i++];
		    if (fdjtKB.contains(outlets,source)) continue;
		    var info=sbook.sourcekb.ref(source);
		    var completion=fdjtDOM
		    ("span.completion.source",info.name);
		    completion.setAttribute("value",source);
		    completion.setAttribute("key",info.name);
		    if (info.about) completion.title=
			"highlight for '"+info.about+"'";
		    fdjtDOM(sources_span,completion," ");}}
	    completions._seen=seen;
	    var tagscores=sbook_index.tagScores();
	    var alltags=tagscores._all;
	    var i=0; while (i<alltags.length) {
		var tag=alltags[i++];
		// We elide sectional tags
		if ((typeof tag === "string") && (tag[0]==="\u00A7")) continue;
		var tagnode=Knodule.HTML(tag,sbook.knodule,false,true);
		fdjtDOM(completions,tagnode," ");}
	    var i=0; while (i<alltags.length) {
		var tag=alltags[i++];
		// We elide sectional tags
		if ((typeof tag === "string") && (tag[0]==="\u00A7")) {
		    var showname=tag; var title;
		    if (showname.length>17) {
			showname=showname.slice(0,17)+"...";
			title=tag;}
		    var sectnode=
			fdjtDOM("span.completion",fdjtDOM("span.sectname",showname));
		    if (title) sectnode.title=title;
		    sectnode.key=tag; sectnode.value=tag;
		    fdjtDOM(completions,sectnode," ");
		    continue;}}
	    // Generic sources go at the end
	    fdjtDOM(completions,sources_span);
	    fdjtDOM.addListener(completions,"click",markcloud_onclick);
	    sbook_mark_cloud=
		new fdjtUI.Completions(
		    completions,false,
		    fdjtUI.FDJT_COMPLETE_OPTIONS|
			fdjtUI.FDJT_COMPLETE_CLOUD|
			fdjtUI.FDJT_COMPLETE_ANYWORD);
	    return sbook_mark_cloud;}

	function markcloud_onclick(evt){
	    var target=fdjtUI.T(evt);
	    var completion=fdjtDOM.getParent(target,'.completion');
	    if (completion) addTag(completion);
	    fdjtUI.cancel(evt);}
	
	/* Other fields */
	
	function xrefs_onkeypress(evt){
	    return fdjtMultiText_onkeypress(evt,'div');}
	sbook.UI.handlers.xrefs_onkeypress;
	
	function gettagspan(input,pt){
	    if (fdjtDOM.hasClass(input,"isempty")) return false;
	    if ((typeof pt === 'undefined')&&
		(typeof input.selectionStart === 'number')&&
		(typeof input.selectionEnd === 'number')&&
		(input.selectionEnd>input.selectionStart)) {
		var val=input.value;
		var start=input.selectionStart;
		var end=input.selectionEnd;
		if ((start>=0)&&(val[start]==='[')) start++;
		if (val[end]===']') end--;
		return [start,end];}
	    if (!(pt)) pt=input.selectionStart;
	    var val=input.value;
	    var start=val.indexOf('[');
	    if ((start<0)||(start>pt)) return false;
	    var scan=val.indexOf('[',start+1);
	    while ((scan>=0)&&(scan<pt)) {
	      start=scan; scan=val.indexOf('[',start+1);}
	    if (start<0) return false;
	    var end=val.indexOf(']',start);
	    if (end<0) return [start+1,pt];
	    else if (end<pt) return false;
	    else return [start,end];}
	function gettagstring(input,pt){
	  var span=gettagspan(input,pt);
	  if (span)
	    return input.value.slice(span[0],span[1]);
	  else return false;}

	function tagspan(input){
	    var value=input.value;
	    var start=value.indexOf('[');
	    if (start<0) return false;
	    var selstart=input.selectionStart;
	    if (start>selstart) return false;
	    var scan=value.indexOf('[',start+1);
	    while ((scan>0)&&(scan<selstart)) {
		start=scan; scan=value.indexOf('[',start+1);}
	    var end=value.indexOf(']',start);
	    if (end<0) {
		if (start+1===selstart) return false;
		else return [start+1,selstart];}
	    else if (end<selstart) return false;
	    else if (start+1===end) return false;
	    else return [start+1,end];}
	function istagging(input){
	  var form=fdjtDOM.getParent(input,"form");
	  var span=tagspan(input);
	  if (span) {
	    fdjtDOM.addClass(form,"tagging");
	    return span;}
	  else {
	    fdjtDOM.dropClass(form,"tagging");
	    return false;}}
	function tagcomplete(input){
	  var span=istagging(input);
	  if (span)
	    sbook_mark_cloud.complete(input.value.slice(span[0],span[1]));}

	// This captures either text selection or mouse motion
	function note_onmouseup(evt){
	  var target=fdjtUI.T(evt);
	  if ((typeof target.selectionStart === 'number')&&
	      (typeof target.selectionEnd === 'number')&&
	      (target.selectionEnd>target.selectionStart)) {
	    var value=target.value;
	    var start=target.selectionStart;
	    var end=target.selectionEnd;
	    if (value[start]==='[') start++;
	    if ((end>0)&&(value[end-1]===']')) end--;
	    if (end>start)
	      sbook_mark_cloud.complete(value.slice(start,end));}
	  else tagcomplete(target);}
	
	function note_onkeyup(evt){
	    var target=fdjtUI.T(evt);
	    var form=fdjtDOM.getParent(target,"FORM");
	    var tagspan=istagging(target);
	    var kc=evt.keyCode;
	    if ((tagspan)&&((kc===8)||(kc===236))) {
		if (sbookMark.tagupdate) {
		    clearTimeout(sbookMark.tagupdate);
		    sbookMark.tagupdate=false;}
		sbookMark.tagupdate=
		    setTimeout(function(){tagcomplete(target);},100);}
	    else if ((kc===13)&&(evt.ctrlKey)) {
		var form=fdjtDOM.getParent(fdjtUI.T(evt),"form");
		fdjtUI.cancel(evt);
		// Should go through AJAX
		form.submit();}}
	function note_onkeypress(evt){
	    var target=fdjtUI.T(evt);
	    var form=fdjtDOM.getParent(target,"FORM");
	    //fdjtLog("kp %o %o",evt,evt.charCode);
	    if (sbookMark.tagupdate) {
		clearTimeout(sbookMark.tagupdate);
		sbookMark.tagupdate=false;}
	    var tagspan=istagging(target);
	    if (!(tagspan)) return;
	    var value=target.value;
	    var tagstring=value.slice(tagspan[0],tagspan[1]);
	    var ch=evt.charCode;
	    if (ch===91)
		sbook_mark_cloud.complete("");
	    else if (ch===93) {
		var completions=sbook_mark_cloud.complete(tagstring);
		if (completions.length) {
		    target.value=
			value.slice(0,tagspan[0])+
			sbook_mark_cloud.getKey(completions[0])+
			((value[tagspan[1]]===']')?
			 (value.slice(tagspan[1]+1)):((value.slice(tagspan[1]))));
		    addTag(form,completions[0]);}
		else addTag(form,tagstring);
		sbook_mark_cloud.complete("");}
	    else if ((ch===34)||(ch===13)) {
		addTag(form,tagstring);
		target.value=
		    value.slice(0,tagspan[1])+
		    ((value[tagspan[1]+1]===']')?'':']')+
		    value.slice(tagspan[1]);
		fdjtUI.cancel(evt);
		target.selectionStart=target.selectionEnd=tagspan[1]+1;
		sbook_mark_cloud.complete("");}
	    else sbookMark.tagupdate=
		setTimeout(function(){tagcomplete(target);},100);}
	
	// Here's how it works:
	//  When typing, go back to the open bracket and try to complete
	//  When you type a ], force a completion
	//  When you click the tag icon, 
	//    Get the tagtext, which is either
	//    if text is selected and it's bracketed, force a completion
	//    otherwise, bracket it and probe a completion
	//    if no text is selected but you're in a tag

	function insertTag(evt){
	    evt=evt||event;
	    fdjtUI.cancel(evt);
	    var target=fdjtUI.T(evt);
	    var form=fdjtDOM.getParent(target,"FORM");
	    var input=fdjtDOM.getChild(form,".addnote");
	    var start=input.selectionStart;
	    var end=input.selectionEnd;
	    fdjtDOM.dropClass(form,markmodes);
	    if ((typeof start === 'number')&&
		(typeof end === 'number')&&
		(end>start)) {
		var val=input.value;
		var sel=val.slice(start,end);
		sbook_mark_cloud.complete(sel);
		input.value=val.slice(0,start)+'['+val.slice(start);
		input.selectionStart=input.selectionEnd=end+1;
		tagcomplete(input);
		input.focus();}
	    else {
	      var tagspan=istagging(input);
	      if (tagspan) 
		addTag(form,input.value.slice(tagspan[0],tagspan[1]));
	      else {
		input.value=
		  input.value.slice(0,start)+'[]'+
		  input.value.slice(start);
		input.selectionStart=input.selectionEnd=start+1;
		tagcomplete(input);}}}
	sbookMark.insertTag=insertTag;
		
	function engage_glossbar(evt){
	    var target=fdjtUI.T(evt);
	    if (fdjtDOM.isClickable(target)) return;
	    var gb=fdjtDOM.getParent(target,".glossbar");
	    fdjtDOM.toggleClass(gb,"engaged");}

	function setupMarkForm(form){
	    if (form.getAttribute("sbooksetup")) return;
	    form.onsubmit=fdjtAjax.onsubmit;
	    form.oncallback=sbookMark.oncallback;
	    var glossbar=fdjtDOM.getChild(form,".glossbar");
	    if (glossbar)
	      fdjtDOM.addListener(glossbar,"click",engage_glossbar);
	    var noteinput=fdjtDOM.getChild(form,"[name='NOTE']");
	    if (noteinput) {
		fdjtDOM.addListener(noteinput,"mouseup",note_onmouseup);
		fdjtDOM.addListener(noteinput,"keyup",note_onkeyup);
		fdjtDOM.addListener(noteinput,"keypress",note_onkeypress);}
	    var origin=fdjtDOM.getChild(form,"input[name='ORIGIN']");
	    if (origin) origin.value=
		document.location.protocol+"//"+document.location.hostname;
	    else fdjtLog("No origin field in form");
	    fdjtUI.AutoPrompt.setup(form);
	    form.setAttribute("sbooksetup","yes");}

	function toggleMarkMode(arg,mode) {
	    if (!(arg)) arg=event;
	    var target=((arg.nodeType)?(arg):(fdjtUI.T(arg)));
	    var form=fdjtDOM.getParent(target,'form');
	    if (!(mode)) fdjtDOM.dropClass(form,markmodes);
	    else if (fdjtDOM.hasClass(form,mode))
		fdjtDOM.dropClass(form,mode);
	    else {
		fdjtDOM.dropClass(form,markmodes);
		fdjtDOM.addClass(form,mode);}}

	/* Mark functions */
	
	function sbookMark(target,gloss,excerpt){
	    setupMarkForm(fdjtID("SBOOKMARKFORM"),gloss,excerpt);
	    if (sbook.mark_target!==target) {fdjtID("SBOOKMARKFORM").reset();}
	    if (typeof excerpt === 'undefined') {
		var selection=window.getSelection();
		var string=((selection)?(selection.toString()):"");
		if (string.length) excerpt=string;}
	    if ((gloss)&&(gloss.user)) {
		// Handle relays and edits
		if (gloss.user===sbook.user.qid)
		    sbookMark.setup(target,gloss||false,excerpt);
		else {
		    sbookMark.setup(target,false,excerpt);
		    if (gloss.gloss) fdjtID("SBOOKMARKRELAY").value=gloss.gloss;
		    if (gloss.user) {
			var userinfo=sbook.sourcekb.map[gloss.user];
			var glossblock=
			    fdjtDOM("div.sbookrelayblock","Relayed from ",
				    fdjtDOM("span.user",userinfo.name),
				    ((gloss.note)&&(": ")),
				    ((gloss.note)?(fdjtDOM("span.note",gloss.note)):(false)));
			fdjtDOM.replace("SBOOKMARKRELAYBLOCK",glossblock);}}}
	    else sbookMark.setup(target,gloss||false,excerpt);
	    sbook.openGlossmark(target,true);
	    sbookMode("mark");
	    fdjtID("SBOOKMARKINPUT").focus();}
	sbookMark.setup=setupHUD;
	sbookMark.oncallback=oncallback;
	sbookMark.getCloud=getCloud;
	sbookMark.toggle=toggleMarkMode;
	sbookMark.revid="$Id$";
	sbookMark.version=parseInt("$Revision$".slice(10,-1));
	sbookMark.cloud=function(){return sbook_mark_cloud;};

	return sbookMark;})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*
/
