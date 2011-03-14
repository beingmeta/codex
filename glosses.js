/* -*- Mode: Javascript; -*- */

var codex_glosses_id="$Id: notes.js 5410 2010-07-31 12:28:42Z haase $";
var codex_glosses_version=parseInt("$Revision: 5410 $".slice(10,-1));

/* Copyright (C) 2009-2011 beingmeta, inc.
   This file implements the search component of a 
   Javascript/DHTML UI for reading large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.
   This file assumes that the sbooks.js file has already been loaded.

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

(function () {

    function sbicon(base){return sbook.graphics+base;}

    function getbracketed(input,erase){
	var string=input.value;
	var pos=input.selectionStart;
	var start=pos, end=pos, lim=string.length;
	while (start>=0) {
	    if (string[start]==='[') {
		if ((start>0)&&(string[start-1]==='\\')) {
		    start--; continue;}
		break;}
	    else start--;}
	if (start<0) return false;
	while (end<lim) {
	    if (string[end]===']') break;
	    else if (string[end]==='\\') end=end+2;
	    else end++;}
	if (start===end) return false;
	if (erase)
	    input.value=string.slice(0,start)+string.slice(end+1);
	else {}
	return string.slice(start+1,end);}

    // set the gloss target for a particular passage
    function getGlossForm(arg) {
	if (typeof arg === 'string')
	    arg=fdjtID(arg)||sbook.glosses.ref(arg)||false;
	if (!(arg)) return false;
	var gloss=((arg.qid)&&(arg));
	var passage=((gloss)?(fdjtID(gloss.frag)):(arg));
	var formid=((gloss)?(fdjtID("CODEXEDITGLOSS_"+gloss.qid)):
		    (fdjtID("CODEXADDGLOSS_"+passage.id)));
	var form=fdjtID(formid);
	var div=((form)&&(form.parentNode));
	if (!(div)) {
	    div=fdjtDOM((gloss)?
			("div.codexglossform.glossedit"):
			("div.codexglossform"));
	    div.innerHTML=sbook_addgloss;
	    fdjtDOM(fdjtID("CODEXGLOSSFORMS"),div);
	    form=fdjtDOM.getChildren(div,"form")[0];
	    if (gloss) form.id="CODEXEDITGLOSS_"+gloss.qid;
	    else form.id="CODEXADDGLOSS_"+passage.id;
	    setupGlossForm(form,passage,gloss);}
	else form=fdjtDOM.getChildren(div,"form")[0];
	// Get any selection to add as an excerpt
	var sel=window.getSelection();
	if (sbook.selection) {
	    var sel=sbook.selection;
	    var seltext=sel.toString();
	    if (seltext.length) {
		addExcerpt(form,seltext);}}
	return div;}
    sbook.getGlossForm=getGlossForm;
    
    function setupGlossForm(form,passage,gloss){
	if (form.getAttribute("sbooksetup")) return;
	form.onsubmit=submitGloss;
	fdjtDOM.getInput(form,"REFURI").value=sbook.refuri;
	fdjtDOM.getInput(form,"USER").value=sbook.user.qid;
	fdjtDOM.getInput(form,"DOCTITLE").value=document.title;
	fdjtDOM.getInput(form,"DOCURI").value=document.location.href;
	fdjtDOM.getInput(form,"FRAG").value=passage.id;
	var noteinput=fdjtDOM.getInput(form,"NOTE");
	if (noteinput) {
	    noteinput.onkeypress=addgloss_keypress;
	    if (gloss) noteinput.value=gloss.note||"";
	    else noteinput.value="";}
	if (sbook.syncstamp)
	    fdjtDOM.getInput(form,"SYNC").value=(sbook.syncstamp+1);
	var info=sbook.docinfo[passage.id];
	var loc=fdjtDOM.getInput(form,"LOCATION");
	var loclen=fdjtDOM.getInput(form,"LOCLEN");
	var tagline=fdjtDOM.getInput(form,"TAGLINE");
	var relay=fdjtDOM.getInput(form,"RELAY");
	var uuidelt=fdjtDOM.getInput(form,"UUID");
	if (loc) {loc.value=info.starts_at;}
	if (loclen) {loclen.value=info.ends_at-info.starts_at;}
	var tagline=getTagline(passage);
	if (tagline) tagline.value=tagline;
	if ((gloss)&&(gloss.tags)) {
	    var tagselt=fdjtDOM.getChild(form,".tags");
	    var tags=gloss.tags;
	    var i=0; var lim=tags.length;
	    while (i<lim) addTag(form,tags[i++]);}
	if ((gloss)&&(gloss.share)) {
	    var tags=gloss.share;
	    if (typeof tags === 'string') tags=[tags];
	    var i=0; var lim=tags.length;
	    while (i<lim) addTag(form,tags[i++],"SHARE");}
	if ((gloss)&&((gloss.qid)||(gloss.uuid)))
	    uuidelt=gloss.qid||gloss.uuid;
	if ((sbook.outlets)||((gloss)&&(gloss.outlets))) {
	    var outlets=sbook.outlets;
	    var current=((gloss)&&(gloss.outlets));
	    if (current) outlets=[].concat(outlets).concat(current);
	    var seen=[];
	    var i=0; var lim=outlets.length;
	    while (i<lim) {
		var outlet=outlets[i++];
		if (fdjtKB.contains(seen,outlet)) continue;
		else addOutlet(
		    form,outlet,
		    ((current)&&(fdjtKB.contains(current,outlet))));}}
	form.setAttribute("sbooksetup","yes");}
    sbook.setupGlossForm=setupGlossForm;

    function getTagline(target){
	var attrib=
	    target.getAttributeNS("tagline","https://sbooks.net/")||
	    target.getAttribute("data-tagline")||
	    target.getAttribute("tagline");
	if (attrib) return attrib;
	var text=fdjtDOM.textify(target);
	if (!(text)) return false;
	text=fdjtString.stdspace(text);
	if (text.length>40) return text.slice(0,40)+"...";
	else return text;}

    /***** Adding outlets ******/
    function addOutlet(form,outlet,checked) {
	var outletspan=fdjtDOM.getChild(form,".outlets");
	if (typeof outlet === 'string') outlet=fdjtKB.ref(outlet);
	var checkbox=fdjtDOM.Checkbox(outlet,outlet.qid);
	var checkspan=fdjtDOM("span.checkspan.outlet",checkbox,
			      outlet.name);
	if (outlet.about) checkspan.title=outlet.about;
	if (checked) {
	    checkbox.checked=true;
	    fdjtDOM.addClass(checkspan,"ischecked");}
	fdjtDOM(outletspan,checkspan," ");}
 
    /***** Adding links ******/
    function addLink(form,url,title) {
	var tagselt=fdjtDOM.getChild(form,'.tags');
	var linkval=((title)?("["+url+" "+title+"]"):(url));
	var checkbox=fdjtDOM.Checkbox("LINKS",linkval,true);
	var checkspan=fdjtDOM("span.checkspan",checkbox,((title)||url));
	checkspan.title=url;
	fdjtDOM(tagselt,checkspan," ");
	return checkspan;}

    /***** Adding excerpts ******/
    function addExcerpt(form,excerpt,id) {
	var tagselt=fdjtDOM.getChild(form,'.tags');
	var value=((id)?("[#"+id+" "+excerpt):(excerpt));
	var checkbox=fdjtDOM.Checkbox("EXCERPT",value,true);
	var checkspan=fdjtDOM("span.checkspan.excerpt",checkbox,
			      "\u201c",
			      ((id)?(fdjtDOM.Anchor("#"+id),excerpt):
			       (excerpt)),
			      "\u201d");
	fdjtDOM(tagselt,checkspan," ");
	return checkspan;}

    /***** Adding tags ******/
    function addTag(form,tag,varname) {
	// fdjtLog("Adding %o to tags for %o",tag,form);
	if (!(tag)) tag=form;
	if (form.tagName!=='FORM')
	    form=fdjtDOM.getParent(form,'form')||form;
	var tagselt=fdjtDOM.getChild(form,'.tags');
	var info; var title=false; var textspec='span.term';
	if (!(varname)) varname='TAGS';
	if ((tag.nodeType)&&(fdjtDOM.hasClass(tag,'completion'))) {
	    if (fdjtDOM.hasClass(tag,'outlet')) {
		varname='OUTLETS'; textspec='span.outlet';}
	    else if (fdjtDOM.hasClass(tag,'source')) {
		varname='SHARE'; textspec='span.source';}
	    else {}
	    if (tag.title) title=tag.title;
	    tag=gloss_cloud.getValue(tag);
	    var input=fdjtDOM.getInput(form,"NOTE");
	    if (input) getbracketed(input,true);}
	var info=
	    ((typeof tag === 'string')&&
	     ((tag.indexOf('|')>0)?
	      (sbook.knodule.handleSubjectEntry(tag)):
	      (fdjtKB.ref(tag)||sbook.knodule.probe(tag))));
	var text=((info)?
		  ((info.toHTML)&&(info.toHTML())||info.name||info.dterm):
		  (tag));
	if (info) {
	    if (info.knodule===sbook.knodule) tag=info.dterm;
	    else tag=info.qid||info.oid||info.dterm||tag;}
	if ((info)&&(info.pool===sbook.sourcekb)) varname='OUTLETS';
	var checkspans=fdjtDOM.getChildren(tagselt,".checkspan");
	var i=0; var lim=checkspans.length;
	while (i<lim) {
	    var cspan=checkspans[i++];
	    if (((cspan.getAttribute("varname"))===varname)&&
		((cspan.getAttribute("tagval"))===tag))
		return cspan;}
	var span=fdjtUI.CheckSpan("span.checkspan",varname,tag,true);
	if (title) span.title=title;
	span.setAttribute("varname",varname);
	span.setAttribute("tagval",tag);
	fdjtDOM.addClass(span,varname.toLowerCase());
	if (typeof text === 'string')
	    fdjtDOM.append(span,fdjtDOM(textspec,text));
	else fdjtDOM.append(span,text);
	fdjtDOM.append(tagselt,span," ");
	return span;}
    
    /***** Setting the gloss target ******/

    // The target can be either a passage or another gloss
    function setGlossTarget(target,form){
	if (!(target)) {
	    var cur=fdjtID("CODEXLIVEGLOSS");
	    if (cur) cur.id=null;
	    sbook.glosstarget=false;
	    return;}
	if (!gloss_cloud) sbook.glossCloud();
	var gloss=false; var form=getGlossForm(target);
	if ((typeof target === 'string')&&(fdjtID(target))) 
	    target=fdjtID(target);
	else if ((typeof target === 'string')&&
		 (sbook.glosses.ref(target))) {
	    gloss=sbook.glosses.ref(target);
	    target=fdjtID(gloss.frag);}
	else if (target.pool===sbook.glosses) {
	    gloss=target; target=fdjtID(gloss.frag);}
	else {}
	var cur=fdjtID("CODEXLIVEGLOSS");
	if (cur) cur.id=null;
	form.id="CODEXLIVEGLOSS";
	var syncelt=fdjtDOM.getInput(form,"SYNC");
	syncelt.value=(sbook.syncstamp+1);
	sbook.glosstarget=target;
	sbook.setTarget(target);
	setCloudCuesFromTarget(gloss_cloud,target);}
    sbook.setGlossTarget=setGlossTarget;

    function setCloudCues(cloud,tags){
      	// Clear any current tagcues from the last gloss
	var cursoft=fdjtDOM.getChildren(cloud.dom,".cue.softcue");
	var i=0; var lim=cursoft.length;
	while (i<lim) {
	    var cur=cursoft[i++];
	    fdjtDOM.dropClass(cur,"cue");
	    fdjtDOM.dropClass(cur,"softcue");}
	// Get the tags on this element as cues
	var newcues=cloud.getByValue(tags);
	var i=0; var lim=newcues.length;
	while (i<lim) {
	    var completion=newcues[i++];
	    if (!(fdjtDOM.hasClass(completion,"cue"))) {
		fdjtDOM.addClass(completion,"cue");
		fdjtDOM.addClass(completion,"softcue");}}}
    function setCloudCuesFromTarget(cloud,target){
	var info=sbook.docinfo[target.id];
	var tags=[].concat(((info)&&(info.tags))||[]);
	var glosses=sbook.glosses.find('frag',target.id);
	var i=0; var lim=glosses.length;
	while (i<lim) {
	    var g=glosses[i++]; var gtags=g.tags;
	    if (gtags) tags=tags.concat(gtags);}
	setCloudCues(cloud,tags);}
    sbook.setCloudCues=setCloudCues;
    sbook.setCloudCuesFromTarget=setCloudCuesFromTarget;
    
    /* Text handling for the gloss text input */

    var addgloss_timer=false;

    function addgloss_keypress(evt){
	var target=fdjtUI.T(evt);
	var string=target.value;
	var form=fdjtDOM.getParent(target,"FORM");
	var ch=evt.charCode;
	if (addgloss_timer) clearTimeout(addgloss_timer);
	if (ch===91) {
	    var pos=target.selectionStart, lim=string.length;
	    if ((pos>0)&&(string[pos-1]==='\\')) return; 
	    fdjtUI.cancel(evt);
	    target.value=string.slice(0,pos)+"[]"+string.slice(pos);
	    target.selectionStart=target.selectionEnd=pos+1;}
	else if (ch===93) {
	    var pos=target.selectionStart;
	    if ((pos>0)&&(string[pos-1]==='\\')) return; 
	    var content=getbracketed(target,true);
	    if (!(content)) return;
	    fdjtUI.cancel(evt);
	    if (content[0]==='@') {
		var brk=content.indexOf(' ');
		if (brk<0) addLink(form,content.slice(1,-1));
		else {
		    addLink(form,linkdata.slice(0,brk),
			    linkdata.slice(brk+1));}}
	    else if (content.indexOf('|')>=0) addTag(form,content);
	    else {
		var completions=gloss_cloud.complete(content);
		if (!(completions)) {
		    addTag(form,content);
		    return;}
		var i=0; var lim=completions.length;
		var std=fdjtString.stdspace(content);
		while (i<lim) {
		    var completion=completions[i++];
		    if (content===gloss_cloud.getKey(completion)) {
			addTag(form,completion);
			return;}}
		addTag(form,std);}}
	else {
	    var content=getbracketed(target);
	    if ((content)&&(content[0]!=='@'))
		addgloss_timer=setTimeout(function(){
		    var span=getbracketed(target,false);
		    gloss_cloud.complete(span);},100);}}

    function get_addgloss_callback(form){
      return function(req){
	return addgloss_callback(req,form);}}

    function addgloss_callback(req,form){
	if (sbook.Trace.network)
	  fdjtLog("Got AJAX gloss response %o from %o",req,sbook_mark_uri);
	fdjtDOM.dropClass(form.parentNode,"submitting");
	fdjtKB.Import(JSON.parse(req.responseText));
	clearGlossForm(form);
	sbook.preview_target=false;
	/* Turn off the target lock */
	sbook.setTarget(false);
	CodexMode(false);}

    function clearGlossForm(form){
	// Clear the UUID, and other fields
	var uuid=fdjtDOM.getInput(form,"UUID");
	if (uuid) uuid.value="";
	var note=fdjtDOM.getInput(form,"NOTE");
	if (note) note.value="";
	var taginput=fdjtDOM.getInput(form,"TAG");
	if (taginput) taginput.value="";
	var href=fdjtDOM.getInput(form,"HREF");
	if (href) href.value="";
	var tagselt=fdjtDOM.getChildren(form,"div.tags");
	if ((tagselt)&&(tagselt.length)) {
	    var tags=fdjtDOM.getChildren(tagselt[0],".checkspan");
	    fdjtDOM.remove(fdjtDOM.Array(tags));}}

    /***** The Gloss Cloud *****/

    var gloss_cloud=false;
    
    /* The completions element */
    function glossCloud(){
	if (gloss_cloud) return gloss_cloud;
	var completions=fdjtID("CODEXGLOSSCLOUD");
	completions.onclick=glosscloud_onclick;
	sbook.gloss_cloud=gloss_cloud=new fdjtUI.Completions(
	    completions,fdjtID("SBOOKTAGINPUT"),
	    fdjtUI.FDJT_COMPLETE_OPTIONS|
		fdjtUI.FDJT_COMPLETE_CLOUD|
		fdjtUI.FDJT_COMPLETE_ANYWORD);
	return gloss_cloud;}
    sbook.glossCloud=glossCloud;

    function glosscloud_onclick(evt){
	var target=fdjtUI.T(evt);
	var completion=fdjtDOM.getParent(target,'.completion');
	if (completion) {
	    var live=fdjtID("CODEXLIVEGLOSS");
	    var form=((live)&&(fdjtDOM.getChild(live,"form")));
	    addTag(form,completion);}
	fdjtUI.cancel(evt);}

    /***** Saving (submitting/queueing) glosses *****/

    // Submits a gloss, queueing it if offline.
    function submitGloss(evt){
	evt=evt||event||null;
	var target=fdjtUI.T(evt);
	fdjtDOM.addClass(target.parentNode,"submitting");
	var form=(fdjtUI.T(evt));
	var uuidelt=fdjtDOM.getInput(form,"UUID");
	if (!((uuidelt)&&(uuidelt.value)&&(uuidelt.value.length>5))) {
	    fdjtLog.warn('missing UUID');
	    if (uuidelt) uuidelt.value=fdjtState.getUUID(sbook.nodeid);}
	setGlossTarget(false);
	if (!(sbook.offline))
	    return fdjtAjax.onsubmit(evt,get_addgloss_callback(target));
	if (!(navigator.onLine)) return saveGloss(form,evt);
	// Eventually, we'll unpack the AJAX handler to let it handle
	//  connection failures by calling saveGloss.
	else return fdjtAjax.onsubmit(evt);}
    sbook.submitGloss=submitGloss;

    function submitEvent(arg){
      var form=((arg.nodeType)?(arg):(fdjtUI.T(arg)));
      while (form)
	if (form.tagName==='FORM') break;
	else form=form.parentNode;
      if (!(form)) return;
      var submit_evt = document.createEvent("HTMLEvents");
      submit_evt.initEvent("submit", true, true);
      form.dispatchEvent(submit_evt);
      return;}
    sbook.UI.submitEvent=submitEvent;

    // Queues a gloss when offline
    function saveGloss(form,evt){
	var json=fdjtAjax.formJSON(form,["tags","xrefs"],true);
	var params=fdjtAjax.formParams(form);
	var queued=fdjtState.getLocal("queued("+sbook.refuri+")",true);
	if (!(queued)) queued=[];
	queued.push(json.uuid);
	var glossdata=
	    {refuri: json.refuri,frag: json.frag,
	     maker: json.maker,uuid: json.uuid,
	     qid: json.uuid,gloss: json.uuid};
	glossdata.tstamp=fdjtTime.tick();
	if ((json.note)&&(!(fdjtString.isEmpty(json.note))))
	    glossdata.note=json.note;
	if ((json.excerpt)&&(!(fdjtString.isEmpty(json.excerpt))))
	    glossdata.excerpt=json.excerpt;
	if ((json.details)&&(!(fdjtString.isEmpty(json.details))))
	    glossdata.details=json.details;
	if ((json.tags)&&(json.tags.length>0)) glossdata.tags=json.tags;
	if ((json.xrefs)&&(json.xrefs.length>0)) glossdata.xrefs=json.xrefs;
	sbook.glosses.Import(glossdata);
	fdjtState.setLocal("params("+json.uuid+")",params);
	fdjtState.setLocal("queued("+sbook.refuri+")",queued,true);
	// Clear the UUID
	clearGlossForm(form);
	sbook.preview_target=false;
	if (evt) fdjtUI.cancel(evt);
	fdjtDOM.dropClass(form.parentNode,"submitting");
	/* Turn off the target lock */
	sbook.setTarget(false);
	CodexMode(false);}
    // Saves queued glosses
    function writeGlosses(){
	if (!(sbook.offline)) return;
	var queued=fdjtState.getLocal("queued("+sbook.refuri+")",true);
	if ((!(queued))||(queued.length===0)) {
	    fdjtState.dropLocal("queued("+sbook.refuri+")");
	    return;}
	var ajax_uri=fdjtID("SBOOKMARKFORM").getAttribute("ajaxaction");
	var i=0; var lim=queued.length; var pending=[];
	while (i<lim) {
	    var uuid=queued[i++];
	    var params=fdjtState.getLocal("params("+uuid+")");
	    if (params) pending.push(uuid);
	    var req=new XMLHttpRequest();
	    req.open('POST',ajax_uri);
	    req.withCredentials='yes';
	    req.onreadystatechange=function () {
		if ((req.readyState === 4) &&
		    (req.status>=200) && (req.status<300)) {
		    fdjtState.dropLocal("params("+uuid+")");
		    oncallback(req);}};
	    try {
		req.setRequestHeader
		("Content-type", "application/x-www-form-urlencoded");
		req.send(params);}
	    catch (ex) {failed.push(uuid);}}
	if ((pending)&&(pending.length))
	    fdjtState.setLocal("queued("+sbook.refuri+")",pending,true);
	else fdjtState.dropLocal("queued("+sbook.refuri+")");
	if ((pending)&&(pending.length>0)) return pending;
	else return false;}
    sbook.writeGlosses=writeGlosses;
    
    /* Gloss display */

    var objectkey=fdjtKB.objectkey;

    function glossBlock(id,spec,xfeatures,glosses,detail){
	var docinfo=sbook.docinfo[id];
	var all=[].concat(xfeatures||[]);
	var freq={}; var notes={}; var links={};
	if (!(glosses)) glosses=sbook.glosses.find('frag',id);
	// Initialize given features
	var i=0; var lim=all.length;
	while (i<lim) freq[all[i++]]=1;
	// Scan glosses
	var i=0; var lim=glosses.length;
	while (i<lim) {
	    var gloss=glosses[i++]; var glossid;
	    if (typeof gloss === 'string') {
		glossid=gloss; gloss=sbook.glosses.ref(glossid);}
	    else glossid=gloss.qid;
	    var user=gloss.maker;
	    var sources=gloss.audience;
	    var tags=gloss.tags;
	    if ((sources)&&(!(sources instanceof Array))) sources=[sources];
	    if ((tags)&&(!(tags instanceof Array))) tags=[tags];
	    if (freq[user]) freq[user]++;
	    else {freq[user]=1; all.push(user);}
	    if (gloss.note) {
		if (notes[user]) fdjtKB.add(notes,user,glossid,true);
		else notes[user]=[glossid];}
	    if (gloss.link) {
		if (links[user]) fdjtKB.add(links,user,glossid,true);
		else links[user]=[glossid];}
	    if (sources) {
		var j=0; var jlim=sources.length;
		while (j<jlim) {
		    var source=sources[j++];
		    if (freq[source]) freq[source]++;
		    else {freq[source]=1; all.push(source);}
		    if (gloss.note) {
			if (notes[source])
			    fdjtKB.add(notes,source,glossid,true);
			else notes[source]=[glossid];}
		    if (gloss.link) {
			if (links[source])
			    fdjtKB.add(links,source,glossid,true);
			else links[source]=[glossid];}}}
	    if (tags) {
		var j=0; var jlim=tags.length;
		while (j<jlim) {
		    var tag=tags[j++];
		    if (typeof tag === 'object') tag=objectkey(tag);
		    if (freq[tag]) freq[tag]++;
		    else {freq[tag]=1; all.push(tag);}}}}
	var tags=docinfo.tags;
	if ((tags)&&(!(tags instanceof Array))) tags=[tags];
	if (tags) {
	    var i=0; var lim=tags.length;
	    while (i<lim) {
		var tag=tags[i++];
		if (typeof tag === 'object') tag=objectkey(tag);
		if (freq[tag]) freq[tag]++;
		else {freq[tag]=1; all.push(tag);}}}
	var info=fdjtDOM(spec||"div.sbookgloss");
	var i=0; var lim=all.length;
	while (i<lim) {
	    var tag=all[i]; var span=false;
	    var taginfo=fdjtKB.ref(tag);
	    if ((taginfo)&&(taginfo.kind)) {
		var srcspan=fdjtDOM("span.source",taginfo.name||tag);
		srcspan.setAttribute("tag",(((taginfo)&&(taginfo.qid))||tag));
		span=fdjtDOM("span",srcspan);
		if (links[tag]) {
		    var sg=links[tag];
		    var j=0; var jlim=sg.length;
		    while (j<jlim) {
			var icon=fdjtDOM.Image(sbicon("DiagLink16x16.png"));
			var gloss=sbook.glosses.ref(sg[j++]);
			var anchor=fdjtDOM.Anchor(gloss.link,"a",icon);
			anchor.title=gloss.note;
			fdjtDOM(span," ",anchor);}}
		if (notes[tag]) {
		    var sg=notes[tag];
		    var j=0; var jlim=sg.length;
		    var icon=fdjtDOM.Image(sbicon("remarkballoon16x13.png"));
		    while (j<jlim) {
			var gloss=sbook.glosses.ref(sg[j++]);
			icon.title=gloss.note; fdjtDOM(span," ",icon);}}}
	    else {
		span=fdjtDOM("span.dterm",taginfo||tag);
		span.setAttribute("tag",(((taginfo)&&(taginfo.qid))||tag));}
	    fdjtDOM(info,((i>0)&&(" \u00b7 ")),span);
	    i++;}
	info.onclick=sbookgloss_onclick;
	return info;}
    sbook.glossBlock=glossBlock;

    function sbookgloss_onclick(evt){
	var target=fdjtUI.T(evt);
	var parent=false;
	while (target) {
	    if (!(target.getAttribute)) target=target.parentNode;
	    else if (target.getAttribute("gloss")) 
		return sbook.showGloss(target.getAttribute("gloss"));
	    else if (target.getAttribute("tag"))
		return sbook.startSearch(target.getAttribute("tag"));
	    else if (target.getAttribute("source"))
		return sbook.startSearch(target.getAttribute("source"));
	    else target=target.parentNode;}
	fdjtUI.cancel(evt);}

    sbook.setInfoTarget=function(passage){
	var infodiv=sbook.glossBlock(passage.id,"div.sbookgloss")
	fdjtDOM.replace("SBOOKTARGETINFO",infodiv);
	fdjtDOM.adjustToFit(fdjtID("SBOOKFOOTINFO"));}

})();

fdjt_versions.decl("codex",codex_glosses_version);
fdjt_versions.decl("codex/glosses",codex_glosses_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
