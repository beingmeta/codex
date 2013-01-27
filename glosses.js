/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/glosses.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements the interface for adding and editing **glosses**,
   which are annotations associated with text passages in a document.

   This file is part of Codex, a Javascript/DHTML web application for reading
   large structured documents (sBooks).

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

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
var Codex=((typeof Codex !== "undefined")?(Codex):({}));
var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

(function () {

    var fdjtString=fdjt.String;
    var fdjtState=fdjt.State;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var fdjtKB=fdjt.KB, fdjtID=fdjt.ID;

    var addClass=fdjtDOM.addClass;
    var hasClass=fdjtDOM.hasClass;
    var dropClass=fdjtDOM.dropClass;
    var swapClass=fdjtDOM.swapClass;
    var toggleClass=fdjtDOM.toggleClass;
    var getParent=fdjtDOM.getParent;
    var hasParent=fdjtDOM.hasParent;
    var getChildren=fdjtDOM.getChildren;
    var getChild=fdjtDOM.getChild;
    var getInput=fdjtDOM.getInput;
    var getInputs=fdjtDOM.getInputs;
    var getInputFor=fdjtDOM.getInputFor;
    var getInputsFor=fdjtDOM.getInputsFor;
    var Ellipsis=fdjtUI.Ellipsis;

    var setCheckSpan=fdjtUI.CheckSpan.set;

    var submitEvent=fdjtUI.submitEvent;

    var glossmodes=Codex.glossmodes;

    var cxicon=Codex.icon;

    var uri_prefix=/(http:)|(https:)|(ftp:)|(urn:)/;

    // The gloss mode is stored in two places:
    //  * the class of the gloss FORM element
    //  * as the class gloss+mode on CODEXHUD (e.g. glossaddtag)
    function getGlossMode(arg){
        if (!(arg)) arg=fdjtID("CODEXLIVEGLOSS");
        if (typeof arg === 'string') arg=fdjtID(arg);
        if ((!(arg))||(!(arg.nodeType))) return false;
        if (arg.tagName!=="FORM") arg=getChild(arg,"FORM");
        var classname=arg.className;
        var match=glossmodes.exec(classname);
        if ((!(match))||(match.length==0)||(!(match[0])))
            return false;
        else return match[0];}
    Codex.getGlossMode=getGlossMode;

    function setGlossMode(mode,arg,toggle){
        if (!(arg)) arg=fdjtID("CODEXLIVEGLOSS");
        if (typeof arg === 'string') arg=fdjtID(arg);
        if ((!(arg))||(!(arg.nodeType))) return;
        var form=((arg.tagName==="FORM")?(arg):
                  ((fdjtDOM.getParent(arg,"form"))||
                   (fdjtDOM.getChild(arg,"form"))));
        var input=false;
        if (!(form)) return;
	if (Codex.Trace.mode) {
	    var frag=fdjtDOM.getInput(form,"FRAG");
	    var uuid=fdjtDOM.getInput(form,"UUID");
	    fdjtLog("setGlossMode %o%s: #%s #U%s",
		    mode,((toggle)?(" (toggle)"):("")),
		    ((frag)&&(frag.value)),
		    ((uuid)&&(uuid.value)));}
        if ((toggle)&&(mode===form.className)) mode=false;
        if (form.className==="editdetail") {
            var detail_elt=getInput(form,"DETAIL");
            if (detail_elt)
                detail_elt.value=fdjt.ID("CODEXGLOSSDETAILTEXT").value;}
        if (!(mode)) {
            dropClass(form,glossmodes);
            dropClass("CODEXHUD",/\bgloss\w+\b/);
            return;}
        if (mode==="addtag") input=fdjtID("CODEXTAGINPUT");
        else if (mode==="addlink") input=fdjtID("CODEXATTACHURL");
        else if (mode==="addoutlet") input=fdjtID("CODEXOUTLETINPUT");
        else if (mode==="editdetail") input=fdjtID("CODEXGLOSSDETAILTEXT");
        else {
            dropClass(form,glossmodes);
            dropClass("CODEXHUD",/\bgloss\w+\b/);
            return;}
        if (Codex.Trace.mode)
            fdjtLog("setGlossMode gm=%s input=%o",mode,input);
        form.className=mode;
        swapClass("CODEXHUD",/\bgloss\w+\b/,"gloss"+mode);
        Codex.setHUD(true);
        if (input) Codex.setFocus(input);}
    Codex.setGlossMode=setGlossMode;

    // set the gloss target for a particular passage
    function getGlossForm(arg,response) {
        if (typeof arg === 'string')
            arg=fdjtID(arg)||Codex.glosses.ref(arg)||false;
        if (!(arg)) return false;
        var gloss=((!(arg.nodeType))&&(arg.maker)&&(arg));
        if (!(gloss)) response=false;
        else if ((arg.maker)&&(arg.maker!==Codex.user._id))
            response=true;
        else {}
        var passage=((gloss)?(fdjtID(gloss.frag)):(arg));
        var passageid=((passage.codexbaseid)||(passage.id));
        var formid=((gloss)?
                    ((response)?
                     ("CODEXRESPONDGLOSS_"+gloss._id):
                     ("CODEXEDITGLOSS_"+gloss._id)):
                    ("CODEXADDGLOSS_"+passageid));
        var form=fdjtID(formid);
        var div=((form)&&(form.parentNode));
        var proto=fdjtID("CODEXADDGLOSSPROTOTYPE");
        if (!(div)) {
            div=proto.cloneNode(true); div.id=null;
            fdjtDOM(fdjtID("CODEXGLOSSFORMS"),div);
            Codex.setupGestures(div);
            form=getChildren(div,"form")[0];
            form.id=formid;
            form=setupGlossForm(form,passage,gloss,response||false);}
        else form=getChildren(div,"form")[0];
        if (gloss) {
            if (response) addClass(div,"glossreply");
            else addClass(div,"glossedit");}
        else addClass(div,"glossadd");
        if (form) return div; else return false;}
    Codex.getGlossForm=getGlossForm;
    
    function setupGlossForm(form,passage,gloss,response){
        var passageid=((passage.codexbaseid)||(passage.id));
        var info=Codex.docinfo[passageid];
        if (form.getAttribute("sbooksetup")) return false;;
        if (!(info)) return false;
        form.onsubmit=submitGloss;
        getInput(form,"REFURI").value=Codex.refuri;
        getInput(form,"DOCTITLE").value=document.title;
        getInput(form,"DOCURI").value=document.location.href;
        getInput(form,"FRAG").value=passageid;
        if (info.wsnid) getInput(form,"WSNID").value=info.wsnid;
        if (Codex.mycopyid)
            getInput(form,"MYCOPYID").value=Codex.mycopyid;
        if (gloss) {
            var date_elt=getChild(form,".glossdate");
            fdjtDOM(date_elt,fdjtTime.shortString(gloss.created));}
        var glossinput=getInput(form,"NOTE");
        var notespan=getChild(form,".notespan");
        if (glossinput) {
            glossinput.onkeypress=glossinput_keypress;
            glossinput.onkeydown=glossinput_keydown;
            glossinput.onfocus=Codex.UI.addgloss_focus;
            glossinput.onblur=Codex.UI.addgloss_blur;
            if ((gloss)&&(!(response))) {
                glossinput.value=gloss.note||"";
                if (notespan) notespan.innerHTML=glossinput.value;}
            else glossinput.value="";}
        if (Codex.syncstamp)
            getInput(form,"SYNC").value=(Codex.syncstamp+1);
        var menu=getChild(form,".addglossmenu");
        fdjt.UI.TapHold(menu,Codex.touch);
        var loc=getInput(form,"LOCATION");
        var loclen=getInput(form,"LOCLEN");
        var tagline=getInput(form,"TAGLINE");
        var respondsto=getInput(form,"RE");
        var thread=getInput(form,"THREAD");
        var uuidelt=getInput(form,"UUID");
        var detailelt=getInput(form,"DETAIL");
        var response_elt=getChild(form,"div.response");
        if ((response_elt)&&(response)&&(gloss)) {
            var maker_elt=getChild(response_elt,".respmaker");
            var date_elt=getChild(response_elt,".respdate");
            var note_elt=getChild(response_elt,".respnote");
            var makerinfo=fdjtKB.ref(gloss.maker);
            fdjtDOM(maker_elt,makerinfo.name);
            fdjtDOM(date_elt,fdjtTime.shortString(gloss.created));
            if (gloss.note) {
                if (gloss.note.length>42) 
                    fdjtDOM(note_elt,gloss.note.slice(0,42)+"…");
                else fdjtDOM(note_elt,gloss.note);
                note_elt.title=gloss.note;}
            else fdjtDOM.remove(note_elt);}
        else {
            fdjtDOM.remove(response_elt); response_elt=false;}
        if (loc) {loc.value=info.starts_at;}
        if (loclen) {loclen.value=info.ends_at-info.starts_at;}
        if ((response)&&(gloss)) {
	    thread.disabled=false; respondsto.disabled=false;
            thread.value=gloss.thread||gloss._id;
            respondsto.value=gloss._id;}
        else {
	    respondsto.disabled=true;
	    thread.disabled=true;}
        var tagline=getTagline(passage);
        if (tagline) tagline.value=tagline;
        if ((gloss)&&(gloss.tags)) {
            var tagselt=getChild(form,".tags");
            var resptags=getChild(response_elt,".resptags");
            var tags=gloss.tags;
            if (typeof tags === 'string') tags=[tags];
            var i=0; var lim=tags.length;
            while (i<lim) {
                addTag(form,tags[i],false);
                i++;}}
        if ((gloss)&&(!(response))&&(gloss.posted)) {
            var wasposted=getChild(form,".wasposted");
            if (wasposted) wasposted.disabled=false;
            var postgloss=getChild(form,".postgloss");
            fdjtUI.setCheckspan(postgloss,true);}
        if ((gloss)&&(!(response))&&(gloss.links)) {
            var links=getChild(form,".links");
            var resplinks=getChild(response_elt,".resplinks");
            var links=gloss.links;
            for (url in links) {
                if (url[0]==='_') continue;
                var urlinfo=links[url];
                var title;
                if (typeof urlinfo === 'string') title=urlinfo;
                else title=urlinfo.title;
                addLink(form,url,title);}}
        if ((gloss)&&(gloss.detail))
            detailelt.value=gloss.detail;
        if ((gloss)&&(gloss.share)) {
            var tags=gloss.share;
            if (typeof tags === 'string') tags=[tags];
            var i=0; var lim=tags.length;
            while (i<lim) addTag(form,tags[i++],"SHARE");}
        if ((!(response))&&(gloss)&&(gloss._id)) {
            uuidelt.value=gloss._id;}
        else uuidelt.value=fdjtState.getUUID(Codex.nodeid);
        if (gloss) {
            // Set the default outlets to unchecked before
            //  adding/setting the assigned outlets.
            resetOutlets(form);
            var shared=((gloss)&&(gloss.shared))||[];
            if (typeof shared === 'string') shared=[shared];
            var i=0, lim=shared.length;
            while (i<lim) addOutlet(form,shared[i++],"SHARE",true);
            var private_span=getChild(form,".private");
            setCheckSpan(private_span,gloss.private);}
        if (((gloss)&&(gloss.excerpt)))
            Codex.setExcerpt(form,gloss.excerpt,gloss.exoff);
        var cancel_button=fdjtDOM.getChild(form,".cancelbutton");
        if (cancel_button)
            fdjtDOM.addListener(
                cancel_button,"click",cancelGloss_handler);
        form.setAttribute("sbooksetup","yes");
        updateForm(form);
        var container=getParent(form,".codexglossform");
        if (container) dropClass(container,"modified");
        return form;}
    Codex.setupGlossForm=setupGlossForm;


    /***** Setting the gloss target ******/

    // The target can be either a passage or another gloss
    function setGlossTarget(target,form){
        if (Codex.glosstarget) {
            dropClass(Codex.glosstarget,"codexglosstarget");}
        dropClass("CODEXHUD",/\bgloss\w+\b/);
        if (!(target)) {
            var cur=fdjtID("CODEXLIVEGLOSS");
            if (cur) cur.id=null;
            Codex.glosstarget=false;
            Codex.glossform=false;
            if (Codex.selecting) {
                Codex.selecting.clear();
                Codex.selecting=false;}
            return;}
        if (!gloss_cloud) Codex.glossCloud();
        var gloss=false;
	// Identify when the target is a gloss
        if ((typeof target === 'string')&&(fdjtID(target))) 
            target=fdjtID(target);
        else if ((typeof target === 'string')&&
                 (Codex.glosses.ref(target))) {
            gloss=Codex.glosses.ref(target);
            target=fdjtID(gloss.frag);}
        else if (target.pool===Codex.glosses) {
            gloss=target; target=fdjtID(gloss.frag);}
        else {}
	if ((gloss)&&(form)&&(!(form.nodeType))) {
	    // Passing a non-false non-node as a form forces a
	    // response, even if the user is the maker of the gloss
	    form=getGlossForm(gloss,true);}
	// Handle or create the form
	if (form) {
	    var frag=fdjtDOM.getInput(form,"FRAG");
	    if (frag.value!==target.id) {
		setExcerpt(form,false);
		fdjtDOM.addClass(form,"modified");
		frag.value=target.id;}}
	else {
	    if (gloss) form=getGlossForm(gloss);
	    else form=getGlossForm(target);
            if (!(form)) {
		fdjtUI.alert("There was a problem adding a gloss");
		return false;}}
        Codex.glosstarget=target;
        addClass(target,"codexglosstarget");
        Codex.GoTo(target,"addgloss",true);
        setCloudCuesFromTarget(gloss_cloud,target);
        setGlossForm(form);
        // Clear current selection and set up new selection
        if (Codex.selecting) {
            Codex.selecting.clear();
            Codex.selecting=false;}
        Codex.clearHighlights(target);
        var dups=Codex.getDups(target);
        Codex.selecting=
            fdjt.UI.Selecting(
                dups,{ontap: gloss_selecting_ontap,
                      onrelease: gloss_selecting_onrelease,
                      fortouch: Codex.touch,
                      holdthresh: 250,
                      movethresh: 250});
        if ((gloss)&&(gloss.excerpt)&&(gloss.excerpt.length))
            Codex.selecting.setString(gloss.excerpt);
        Codex.selecting.onchange=function(sel){
            var string=this.getString();
            var off=this.getOffset();
            Codex.setExcerpt(form,string,off);};
        return form;}
    Codex.setGlossTarget=setGlossTarget;

    function setGlossForm(form){
        var cur=fdjtID("CODEXLIVEGLOSS");
        if (cur) cur.id=null;
        if (!(form)) {
	    Codex.glossform=false;
	    return;}
        form.id="CODEXLIVEGLOSS";
        if ((Codex.glossform)&&
            (Codex.glossform.className==="editdetail")) {
            var oldform=Codex.glossform;
            var detail_elt=getInput(oldform,"DETAIL");
            detail_elt.value=fdjt.ID("CODEXGLOSSDETAILTEXT").value;
            detail_elt=getInput(form,"DETAIL");
            fdjt.ID("CODEXGLOSSDETAILTEXT").value=detail_elt.value;}
	Codex.glossform=form;
        var form_elt=getChild(form,"FORM");
        var mode=form_elt.className;
	var glossinput=getInput(form,"NOTE");
        var syncelt=getInput(form,"SYNC");
        syncelt.value=(Codex.syncstamp+1);
        /* Get the input appropriate to the mode. */
        gloss_cloud.complete(getbracketed(glossinput,false)||"");
        
        /* Do completions based on those input's values */
        Codex.outletCloud().complete();
        Codex.glossCloud().complete();}
    Codex.setGlossForm=setGlossForm;

    function updateForm(form){
        var glossetc=getChild(form,".glossetc");
        fdjtUI.Overflow(glossetc);}

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

    function addOutlet(form,outlet,formvar,checked) {
        if (typeof checked === 'undefined') checked=true;
        var wrapper=getParent(form,".codexglossform");
        addClass(wrapper,"modified");
        var outletspan=getChild(form,".outlets");
        var outlet_id=((typeof outlet === 'string')?(outlet):(outlet._id));
        if (typeof outlet === 'string') {
            if ((outlet[0]==='@')||
                ((outlet[0]===':')&&(outlet[0]==='@')))
                outlet=Codex.sourcekb.ref(outlet);
            else {
                outlet={name: outlet};
                spanspec="span.checkspan.email";
                if (!(formvar)) formvar="EMAIL";}}
        else if (outlet.nodeType) {
            if (!(formvar)) formvar="NETWORK";
            outlet_id=outlet.getAttribute("value");
            outlet={name: outlet.getAttribute("key")||outlet_id};}
        else {}
        if (!(formvar)) formvar="SHARE";
        var inputs=getInputs(form,formvar);
        var i=0; var lim=inputs.length;
        while (i<lim) {
            if (inputs[i].value===outlet_id) {
                var checkspan=getParent(inputs[i],".checkspan");
                setCheckSpan(checkspan,checked);
                return checkspan;}
            else i++;}
        var spanspec=(
            "span.checkspan.waschecked.ischecked.outlet."+
                formvar.toLowerCase());
        var checkspan=fdjtUI.CheckSpan(
            spanspec,formvar||"SHARE",outlet_id,checked,
            "→",outlet.nick||outlet.name,
            fdjtDOM.Image(cxicon("redx",32,32),"img.redx","x"));
        if ((outlet.nick)&&(outlet.description))
            checkspan.title=outlet.name+": "+outlet.description;
        else if (outlet.description)
            checkspan.title=outlet.description;
        else checkspan.title=outlet.name;
        fdjtDOM(outletspan,checkspan," ");
        dropClass(outletspan,"empty");
        return checkspan;}
    Codex.addOutlet2Form=addOutlet;

    function clearOutlets(form){
        var outletspan=getChild(form,".outlets");
        fdjtDOM.replace(outletspan,fdjtDOM("span.outlets"));}
    function resetOutlets(form){
        var outletspan=getChild(form,".outlets");
        var outlets=getChildren(outletspan,".checkspan");
        var i=0, lim=outlets.length;
        while (i<lim) {
            var span=outlets[i++];
            setCheckSpan(span,false);}}
    

    /***** Adding links ******/
    
    function addLink(form,url,title) {
        var linkselt=getChild(form,'.links');
        var linkval=((title)?(url+" "+title):(url));
        var img=fdjtDOM.Image(cxicon("diaglink",32,32),"img");
        var anchor=fdjtDOM.Anchor(url,"a.glosslink",((title)||url));
        var checkbox=fdjtDOM.Checkbox("LINKS",linkval,true);
        var aspan=fdjtDOM("span.checkspan.ischecked.waschecked.anchor",
                          img,checkbox,anchor,
                          fdjtDOM.Image(cxicon("redx",32,32),"img.redx","x"));
        var wrapper=getParent(form,".codexglossform");
        addClass(wrapper,"modified");
        aspan.title=url; anchor.target='_blank';
        fdjtDOM(linkselt,aspan," ");
        dropClass(linkselt,"empty");
        updateForm(form);
        return aspan;}
    Codex.addLink2Form=addLink;


    /***** Adding excerpts ******/
    
    function setExcerpt(form,excerpt,off) {
        var checkspan=getChild(form,'.excerpt');
        if (!(checkspan)) {
            // This is for the case where the excerpt
            //  doesn't actually appear (the new default)
            var input=getInput(form,'EXCERPT');
            var exoff=getInput(form,'EXOFF');
            if ((!(excerpt))||(fdjtString.isEmpty(excerpt))) {
                input.value=""; exoff.value="";
                input.disabled=exoff.disabled=true;
                return;}
            input.disabled=exoff.disabled=false;
            input.value=excerpt;
            if (typeof off === "number")
                exoff.value=off;
            else {
                exoff.value="";
                exoff.disabled=true;}
            updateForm(form);
            var wrapper=getParent(form,".codexglossform");
            addClass(wrapper,"modified");
            return;}
        var input=getInput(checkspan,'EXCERPT');
        var exoff=getInput(form,'EXOFF');
        var text=getChild(checkspan,'.text');
        if (fdjtString.isEmpty(excerpt)) excerpt=false;
        if (excerpt) {
            input.value=excerpt;
            if (exoff) {
                if (off) exoff.value=off;
                else exoff.value="";}
            dropClass(checkspan,"empty");
            fdjtDOM.replace(text,Ellipsis("span.text",excerpt,[25,15]));
            setCheckSpan(checkspan,true);}
	else if ((off)&&(off<0)) {
	    // This clears the entry altogether
            addClass(checkspan,"empty");
            if (exoff) exoff.value="";
	    input.value="";
	    if (text) fdjtDOM.replace(text,fdjtDOM("span.text"));
            setCheckSpan(checkspan,false);}
        else {
            addClass(checkspan,"empty");
            if (exoff) exoff.value="";
            setCheckSpan(checkspan,false);}
        var wrapper=getParent(form,".codexglossform");
        addClass(wrapper,"modified");
        updateForm(form);}
    Codex.setExcerpt=setExcerpt;


    /***** Adding tags ******/

    var Ref=fdjtKB.Ref;

    function addTag(form,tag,varname,checked,knodule) {
        // fdjtLog("Adding %o to tags for %o",tag,form);
        if (!(tag)) tag=form;
        if (form.tagName!=='FORM')
            form=getParent(form,'form')||form;
        if (!(knodule)) knodule=Codex.getMakerKnodule(Codex.user);
        if (typeof checked==="undefined") checked=true;
        var wrapper=getParent(form,".codexglossform");
        addClass(wrapper,"modified");
        var tagselt=getChild(form,'.tags');
        var info; var title=false; var textspec='span.term';
        if (!(varname)) varname='TAGS';
        if ((tag.nodeType)&&(hasClass(tag,'completion'))) {
            if (hasClass(tag,'outlet')) {
                varname='SHARED'; textspec='span.outlet';}
            else if (hasClass(tag,'source')) {
                varname='SHARE'; textspec='span.source';}
            else {}
            if (tag.title) title=tag.title;
            tag=gloss_cloud.getValue(tag);}
        var ref=
            ((tag instanceof Ref)?(tag):
             ((typeof tag === 'string')&&
              ((tag.indexOf('|')>0)?
               (knodule.handleSubjectEntry(tag)):
               (tag.indexOf('@')>=0)?(fdjtKB.ref(tag)):
               (knodule.probe(tag)))));
        var text=
            ((ref)?
             (((ref.toHTML)&&(ref.toHTML()))||
              ref.name||ref.dterm||ref.EN||ref._qid||ref._id):
             (typeof tag === "string")?(tag):
             (tag.toString()));
        var tagval=tag;
        if (ref) {
            if (ref.knodule===knodule) tagval=ref.dterm;
            else tagval=ref._qid||ref._id||ref.dterm||ref.name||tag;}
        if ((ref)&&(ref.pool===Codex.sourcekb)) varname='SHARED';
        var checkspans=getChildren(tagselt,".checkspan");
        var i=0; var lim=checkspans.length;
        while (i<lim) {
            var cspan=checkspans[i++];
            if (((cspan.getAttribute("varname"))===varname)&&
                ((cspan.getAttribute("tagval"))===tagval)) {
                if (checked) addClass(cspan,"waschecked");
                return cspan;}}
        var span=fdjtUI.CheckSpan("span.checkspan",varname,tagval,checked);
        if (checked) addClass(span,"waschecked");
        if (title) span.title=title;
        span.setAttribute("varname",varname);
        span.setAttribute("tagval",tag);
        addClass(span,("glosstag"));
        addClass(span,((varname.toLowerCase())+"var"));
        if (typeof text === 'string')
            fdjtDOM.append(span,fdjtDOM(textspec,text));
        else fdjtDOM.append(span,text);
        fdjtDOM.append(
            span,fdjtDOM.Image(cxicon("redx",32,32),"img.redx","x"));
        fdjtDOM.append(tagselt,span," ");
        dropClass(tagselt,"empty");
        updateForm(form);
        return span;}
    Codex.addTag2Form=addTag;

    Codex.setGlossNetwork=function(form,network,checked){
        if (typeof form === 'string') form=fdjtID(form);
        if (!(form)) return;
        var input=getInput(form,'NETWORKS',network);
        if (!(input)) return;
        var cs=getParent(input,".checkspan");
        if (!(cs)) return;
        setCheckSpan(cs,checked);};

    var selecting_ontap=fdjt.UI.Selecting.tap_handler;
    function gloss_selecting_ontap(evt){
        if (Codex.mode!=="addgloss") {
            Codex.setMode("addgloss");
            fdjtUI.cancel(evt);}
        else return selecting_ontap(evt);}
    function gloss_selecting_onrelease(evt){
        evt=evt||event;
        Codex.UI.content_release(evt);
        Codex.setMode("addgloss");
        Codex.setHUD(true);
        var input=((Codex.glossform)&&
                   ((getInputs(Codex.glossform,"NOTE"))[0]));
        if (input) Codex.setFocus(input);}

    function setCloudCues(cloud,tags){
        // Clear any current tagcues from the last gloss
        var cursoft=getChildren(cloud.dom,".cue.softcue");
        var i=0; var lim=cursoft.length;
        while (i<lim) {
            var cur=cursoft[i++];
            dropClass(cur,"cue");
            dropClass(cur,"softcue");}
        // Get the tags on this element as cues
        var newcues=cloud.getByValue(tags);
        var i=0; var lim=newcues.length;
        while (i<lim) {
            var completion=newcues[i++];
            if (!(hasClass(completion,"cue"))) {
                addClass(completion,"cue");
                addClass(completion,"softcue");}}}
    function setCloudCuesFromTarget(cloud,target){
        var tags=[];
        var targetid=((target.codexbaseid)||(target.id));
        var info=Codex.docinfo[targetid];
        var glosses=Codex.glosses.find('frag',targetid);
        var knodule=Codex.knodule;
        if ((info)&&(info.tags)) tags=tags.concat(info.tags);
        if ((info)&&(info.autotags)&&(info.autotags.length)) {
            var autotags=info.autotags; var j=0; var jlim=autotags.length;
            while (j<jlim) {
                var kn=knodule.probe(autotags[j]);
                if (kn) tags.push(kn.tagString());
                j++;}}
        var i=0; var lim=glosses.length;
        while (i<lim) {
            var g=glosses[i++]; var gtags=g.tags;
            if (gtags) tags=tags.concat(gtags);}
        setCloudCues(cloud,tags);}
    Codex.setCloudCues=setCloudCues;
    Codex.setCloudCuesFromTarget=setCloudCuesFromTarget;
    
    /* Text handling for the gloss text input */

    // This is use for delaying completion calls and keeping them from
    // clobbering one another
    var addgloss_timer=false;
    
    function _getbracketed(input,erase){
        var string=input.value;
        if ((!(string))||(string.length==0)) return false;
        var pos=input.selectionStart||0;
        var start=pos, end=pos, lim=string.length;
        while (start>=0) {
            if (string[start]==='[') {
                if ((start>0)&&(string[start-1]==='\\')) {
                    start--; continue;}
                else if ((start>0)&&(string[start-1]==='['))
                    break;
                else start--;}
            else if ((string[start]===']')&&(start>0)&&
                     (string[start-1]===']'))
                return false;
            else start--;}
        if (start<0) return false;
        while (end<lim) {
            if ((string[end]===']')&&(string[end+1]=="]")) {
                break;}
            else if (string[end]==='\\') end=end+2;
            else end++;}
        if (start===end) return false;
        if (erase) {
            input.value=string.slice(0,start-1)+string.slice(end+2);}
        return string.slice(start+1,end);}

    function getbracketed(input,erase){
        var bracketed=_getbracketed(input,erase);
        if ((bracketed)&&(!(linkp(bracketed)))) {
            addClass("CODEXHUD","glosstagging");
            Codex.UI.updateScroller("CODEXGLOSSTAGS");}
        else dropClass("CODEXHUD","glosstagging");
        return bracketed;}

    function linkp(string){
        return ((string[0]==="@")||(string.search(uri_prefix)===0));}
    
    function setbracketed(input,replacement,atend){
        var string=input.value;
        if ((!(string))||(string.length==0)) return false;
        var pos=input.selectionStart||0;
        var start=pos, end=pos, lim=string.length;
        while (start>=0) {
            if (string[start]==='[') {
                if ((start>0)&&(string[start-1]==='\\')) {
                    start--; continue;}
                else if ((start>0)&&(string[start-1]==='['))
                    break;
                else start--;}
            else start--;}
        if (start<0) return false;
        while (end<lim) {
            if ((string[end]===']')&&(string[end+1]=="]")) {
                break;}
            else if (string[end]==='\\') end=end+2;
            else end++;}
        if (start===end) return false;
        input.value=string.slice(0,start-1)+
            "[["+replacement+"]]"+
            string.slice(end+2);
        if (atend) input.selectionStart=
            input.selectionEnd=start+replacement.length+4;
        return true;}

    function getTagString(span,content){
        var tagval=span.getAttribute("tagval");
        if (tagval) {
            var at=tagval.indexOf('@');
            if ((Codex.knodule)&&(at>0)&&
                (tagval.slice(at+1)===Codex.knodule.name))
                return tagval.slice(0,at);
            else return tagval;}
        else {
            var bar=content.indexOf('|');
            if (bar>0) return content.slice(0,bar);
            else return content;}}

    var stdspace=fdjtString.stdspace;

    function handleBracketed(form,content,complete){
        dropClass("CODEXHUD","glosstagging");
        if ((content[0]==='@')||(content.search(uri_prefix)===0)) {
            var start=(content[0]==='@');
            var brk=content.search(/\s/);
            if (brk<0) addLink(form,content.slice(start));
            else {
                addLink(form,content.slice(start,brk),
                        content.slice(brk+1));}
            return false;}
        else if (content.indexOf('|')>=0) {
            var span=addTag(form,content);
            return getTagString(span,stdspace(content));}
        else return handleTagInput(content,form,true);}

    function handleTagInput(content,form,exact){
        var completions=gloss_cloud.complete(content);
        var std=stdspace(content);
        if ((!(completions))||(completions.length===0)) {
            addTag(form,std);
            gloss_cloud.complete("");
            return std;}
        else {
            var completion=false;
            if (completions.length===1)
                completion=completions[0];
            else if ((completions.exact)&&
                     (completions.exact.length===1))
                completion=completions.exact[0];
            else {
                // Multiple completions
                completion=completions[0];
                var i=0, lim=completions.length;
                while (i<lim) {
                    var c=completions[i++];
                    if (c!==completion) {completion=false; break;}}}
            if ((completion)&&(completion===completions[0])) {
                var ks=gloss_cloud.getKey(completions.matches[0]);
                if ((exact)?(ks.toLowerCase()!==std.toLowerCase()):
                    (ks.toLowerCase().search()!==0)) {
                    // When exact is true, count on exact matches;
                    // even if it is false, don't except non-prefix
                    // matches
                    addTag(form,std);
                    gloss_cloud.complete("");
                    return std;}}
            if (completion) {
                var span=addTag(form,completion);
                gloss_cloud.complete("");
                return getTagString(
                    span,gloss_cloud.getKey(completion));}
            else {
                addTag(form,std);
                gloss_cloud.complete("");
                return std;}}}
    Codex.handleTagInput=handleTagInput;

    /* This handles embedded brackets */
    function glossinput_keypress(evt){
        var target=fdjtUI.T(evt);
        var string=target.value;
        var form=getParent(target,"FORM");
        var ch=evt.charCode;
        var wrapper=getParent(form,".codexglossform");
        addClass(wrapper,"modified");
        if (addgloss_timer) {
            clearTimeout(addgloss_timer);
            addgloss_timer=false;}
        if (ch===91) { /* [ */
            var pos=target.selectionStart, lim=string.length;
            if ((pos>0)&&(string[pos-1]==='\\')) return; 
            fdjtUI.cancel(evt);
            fdjtDOM.insertText(target,"[]",1);}
        else if (ch===93) { /* ] */
            var pos=target.selectionStart;
            if ((pos>0)&&(string[pos-1]==='\\')) return; 
            var content=getbracketed(target);
            if (!(content)) return;
            fdjtUI.cancel(evt);
            var replace=handleBracketed(form,content);
            if (replace) setbracketed(target,replace,2);}
        else if (ch===13) {fdjtUI.cancel(evt);}
        else {
            var content=getbracketed(target);
            if ((typeof content==='string')&& (!(linkp(content))))
                // This timer ensures that the character typed
                // actually gets into the box before we do anything
                addgloss_timer=setTimeout(function(){
                    addgloss_timer=false;
                    var span=getbracketed(target,false);
                    if (!(linkp(content)))
                        gloss_cloud.complete(span);},
                                          200);}}

    function glossinput_keydown(evt){
        evt=evt||event;
        var kc=evt.keyCode;
        var target=fdjtUI.T(evt);
        var form=getParent(target,'form');
        var mode=getGlossMode(form);
        if (addgloss_timer) {
            clearTimeout(addgloss_timer);
            addgloss_timer=false;}
        if (kc===13) { // newline/enter
            var bracketed;
            if (fdjtString.isEmpty(target.value)) {
                fdjtUI.cancel(evt);
                submitGloss(form);}
            else if (bracketed=getbracketed(target)) {
                // If you're in a [[]], handle entry/completion
                fdjtUI.cancel(evt);
                if (evt.ctrlKey)
                    handleBracketed(form,getbracketed(target,true));
                else {
                    var replace=handleBracketed(form,getbracketed(target));
                    if (replace) setbracketed(target,replace,2);}}
            else if (evt.shiftKey) {
                // This inserts a hard newline
                fdjtUI.cancel(evt);
                fdjtDOM.insertText(target,'\n');}
            else if (evt.ctrlKey) {
                var note=target.value;
                fdjtUI.cancel(evt);
                if (note.search(uri_prefix)===0) {
                    var brk=note.search(/\s/);
                    if (brk<0) addLink(form,note);
                    else addLink(form,note.slice(0,brk),note.slice(brk+1));}
                else addTag(form,note,"TAGS",true,Codex.knodule);
                target.value="";}
            else {
                fdjtUI.cancel(evt);
                submitGloss(form);}}
        else if (mode) {}
        else {
            var content=getbracketed(target);
            if (!(typeof content==='string')) {}
            else addgloss_timer=setTimeout(
                function(){
                    // This timer ensures that the character typed
                    // actually gets into the box before we do anything
                    addgloss_timer=false;
                    var span=getbracketed(target,false);
                    gloss_cloud.complete(span);},
                200);}}
    
    function get_addgloss_callback(form,keep){
        return function(req){
            return addgloss_callback(req,form,keep);}}

    function addgloss_callback(req,form,keep){
        if (Codex.Trace.network)
            fdjtLog("Got AJAX gloss response %o from %o",req,sbook_mark_uri);
        dropClass(form.parentNode,"submitting");
        var json=JSON.parse(req.responseText);
        var ref=Codex.glosses.Import(json);
        var reps=document.getElementsByName(json.uuid);
        var i=0, lim=reps.length;
        while (i<lim) {
            var rep=reps[i++];
            if (hasClass(rep,"codexcard"))
                fdjtDOM.replace(rep,Codex.renderCard(ref));}
        /* Turn off the target lock */
        if (!(keep)) {
            fdjtDOM.remove(form.parentNode);
            setGlossTarget(false);
            Codex.setTarget(false);
            Codex.setMode(false);}}

    function clearGlossForm(form){
        // Clear the UUID, and other fields
        var uuid=getInput(form,"UUID");
        if (uuid) uuid.value="";
        var note=getInput(form,"NOTE");
        if (note) note.value="";
        var href=getInput(form,"HREF");
        if (href) href.value="";
        var tagselt=getChildren(form,".tags");
        if ((tagselt)&&(tagselt.length)) {
            var tags=getChildren(tagselt[0],".checkspan");
            fdjtDOM.remove(fdjtDOM.Array(tags));}}


    /***** The Gloss Cloud *****/

    var gloss_cloud=false;
    
    /* The completions element */
    function glossCloud(){
        if (gloss_cloud) return gloss_cloud;
        var completions=fdjtID("CODEXGLOSSCLOUD");
        completions.onclick=glosscloud_ontap;
        Codex.gloss_cloud=gloss_cloud=
            new fdjtUI.Completions(
                completions,fdjtID("CODEXTAGINPUT"),
                fdjtUI.FDJT_COMPLETE_OPTIONS|
                    fdjtUI.FDJT_COMPLETE_CLOUD|
                    fdjtUI.FDJT_COMPLETE_ANYWORD);
        return gloss_cloud;}
    Codex.glossCloud=glossCloud;
    
    function glosscloud_ontap(evt){
        var target=fdjtUI.T(evt);
        var completion=getParent(target,'.completion');
        if (completion) {
            var live=fdjtID("CODEXLIVEGLOSS");
            var form=((live)&&(getChild(live,"form")));
            var span=addTag(form,completion);
            if (!(hasClass("CODEXHUD","glossaddtag"))) {
                // This means we have a bracketed reference
                var tagstring=getTagString(
                    span,gloss_cloud.getKey(completion));
                var input=getInput(form,"NOTE");
                if ((input)&&(tagstring))
                    setbracketed(input,tagstring,2);}}
        fdjtUI.cancel(evt);}


    /***** The Outlet Cloud *****/

    var outlet_cloud=false;
    
    /* The completions element for outlets */
    function outletCloud(){
        if (outlet_cloud) return outlet_cloud;
        var completions=fdjtID("CODEXOUTLETCLOUD");
        completions.onclick=outletcloud_ontap;
        Codex.outlet_cloud=outlet_cloud=
            new fdjtUI.Completions(
                completions,fdjtID("CODEXOUTLETINPUT"),
                fdjtUI.FDJT_COMPLETE_OPTIONS|
                    fdjtUI.FDJT_COMPLETE_CLOUD|
                    fdjtUI.FDJT_COMPLETE_ANYWORD);
        var queue=Codex.outlet_cloud_queue;
        Codex.outlet_cloud_queue=[];
        Codex.addOutlets2UI(queue);
        return outlet_cloud;}
    Codex.outletCloud=outletCloud;
    
    function outletcloud_ontap(evt){
        var target=fdjtUI.T(evt);
        var completion=getParent(target,'.completion');
        if (completion) {
            var live=fdjtID("CODEXLIVEGLOSS");
            var form=((live)&&(getChild(live,"form")));
            if (hasClass(completion,"source")) {
                var value=completion.getAttribute("value");
                if (value) addOutlet(form,fdjtKB.ref(value),"SHARE");}
            else if (hasClass(completion,"network")) 
                addOutlet(form,completion,"NETWORK");
            else if (hasClass(completion,"email")) 
                if (value) addOutlet(form,completion,"EMAIL");
            else addOutlet(form,completion);}
        fdjtUI.cancel(evt);}


    /***** Saving (submitting/queueing) glosses *****/

    // Submits a gloss, queueing it if offline.
    function submitGloss(arg,keep){
        var div=false, form=false;
        if (typeof arg === "undefined") {
            div=fdjtID("CODEXLIVEGLOSS");
            if (!(div)) return;
            form=getChild(div,"FORM");}
        else {
            if (!(arg.nodeType)) arg=fdjtUI.T(arg);
            if ((arg.nodeType)&&(arg.nodeType===1)&&
                (arg.tagName==="FORM")) {
                form=arg; div=getParent(form,".codexglossform");}
            else if ((arg.nodeType)&&(arg.nodeType===1)&&
                     (arg.tagName==="DIV")&&(hasClass(arg,"codexglossform"))) {
                div=arg; form=getChild(div,"FORM");}}
        if (!(form)) return;
        if (form.className==="editdetail") {
            var detail_elt=getInput(form,"DETAIL");
            if (detail_elt) {
                detail_elt.value=
                    fdjt.ID("CODEXGLOSSDETAILTEXT").value;
                fdjt.ID("CODEXGLOSSDETAILTEXT").value="";}}
        addClass(div,"submitting");
        if (!((hasParent(form,".glossedit"))||
              (hasParent(form,".glossreply"))))
            // Only save defaults if adding a new gloss
            saveGlossDefaults(form,getChild("CODEXADDGLOSSPROTOTYPE","FORM"));
        var uuidelt=getInput(form,"UUID");
        if (!((uuidelt)&&(uuidelt.value)&&(uuidelt.value.length>5))) {
            fdjtLog.warn('missing UUID');
            if (uuidelt) uuidelt.value=fdjtState.getUUID(Codex.nodeid);}
        var note_input=getInputs(form,"NOTE")[0];
        if (note_input.value.search(uri_prefix)===0) {
            // This is a convenience kludge where notes that look like
            // URLs are stored as links.
            var note=note_input.value;
            var brk=note.search(/\s/);
            if (brk<0) addLink(form,note);
            else addLink(form,note.slice(0,brk),note.slice(brk+1));
            noteinput.value="";}
        var sent=((navigator.onLine)&&
                  (fdjt.Ajax.onsubmit(form,get_addgloss_callback(form,keep))));
        if (!(sent)) queueGloss(form,((arg)&&(arg.type)&&(arg)));
        else dropClass(div,"modified");}
    Codex.submitGloss=submitGloss;

    function cancelGloss_handler(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var glossform=(target)&&
            (fdjtDOM.getParent(target,".codexglossform"));
        cancelGloss(target);
        fdjtUI.cancel(evt);}

    function cancelGloss(arg){
        var evt=arg||event||null;
        var target=((!arg)?(fdjtID("CODEXLIVEGLOSS")):
                    (arg.nodeType)?(arg):(fdjtUI.T(arg)));
        var glossform=(target)&&
            (fdjtDOM.getParent(target,".codexglossform"));
        setGlossTarget(false);
        Codex.setMode(false);
        if ((arg)&&((arg.cancelable)||(arg.bubbles))) {
            fdjtUI.cancel(evt);}
        if (glossform) fdjtDOM.remove(glossform);}
    Codex.cancelGloss=cancelGloss;

    // We save gloss defaults on the prototype gloss form hidden in the DOM
    function saveGlossDefaults(form,proto){
        // Save gloss mode (??)
        var mode=form.className;
        swapClass(proto,glossmodes,mode);
        // Save post setting
        var post=getInput(form,"POSTGLOSS");
        var proto_post=getInput(form,"POSTGLOSS");
        setCheckSpan(proto_post,post.checked);
        // Save network settings
        var networks=getInputs(form,"NETWORKS");
        var i=0, lim=networks.length;
        while (i<lim) {
            var input=networks[i++];
            var proto_input=getInputFor(form,"NETWORKS",input.value);
            setCheckSpan(proto_input,input.checked);}
        // Save outlets
        clearOutlets(proto);
        var shared=getChild(form,".outlets");
        var inputs=getChildren(shared,"INPUT");
        // Here's the logic: we save all checked outlets and any
        // others up to 5.
        var i=0, lim=inputs.length, n_added=0;
        while (i<lim) {
            var input=inputs[i++];
            if (input.checked) {
                var checkspan=addOutlet(
                    proto,input.value,input.name,input.checked);
                addClass(checkspan,"waschecked");
                n_added++;}}
        if (n_added<6) {
            i=0; while (i<lim) {
                var input=inputs[i++];
                if (n_added>5) continue;
                if (!(input.checked)) {
                    var checkspan=addOutlet(
                        proto,input.value,input.name,input.checked);
                    n_added++;}}}}

    var queued_glosses=[], queued_data={};

    // Queues a gloss when offline
    function queueGloss(form,evt){
        // We use the JSON to update the local database and save the
        // params to send when we get online
        var json=fdjt.Ajax.formJSON(form,true);
        var params=fdjt.Ajax.formParams(form);
        if (Codex.persist) {
            var queued=fdjtState.getLocal("queued("+Codex.refuri+")",true);
            if (!(queued)) queued=[];
            queued.push(json.uuid);
            fdjtState.setLocal("params("+json.uuid+")",params);
            fdjtState.setLocal("queued("+Codex.refuri+")",queued,true);}
        else {
            queued_glosses.push(json.uuid);
            queued_data[json.uuid]=params;}
        // Now save it to the in-memory database
        var glossdata=
            {refuri: json.refuri,frag: json.frag,
             maker: json.user,_id: json.uuid,uuid: json.uuid,
             qid: json.uuid,gloss: json.uuid,
             created: fdjtTime()};
        glossdata.tstamp=fdjtTime.tick();
        if ((json.note)&&(!(fdjtString.isEmpty(json.note))))
            glossdata.note=json.note;
        if ((json.excerpt)&&(!(fdjtString.isEmpty(json.excerpt)))) {
            glossdata.excerpt=json.excerpt;
	    glossdata.exoff=json.exoff;}
        if ((json.details)&&(!(fdjtString.isEmpty(json.details))))
            glossdata.details=json.details;
        if ((json.tags)&&(json.tags.length>0)) glossdata.tags=json.tags;
        if ((json.xrefs)&&(json.xrefs.length>0)) glossdata.xrefs=json.xrefs;
        Codex.glosses.Import(glossdata);
        // Clear the UUID
        clearGlossForm(form);
        if (evt) fdjtUI.cancel(evt);
        dropClass(form.parentNode,"submitting");
        /* Turn off the target lock */
        setGlossTarget(false); Codex.setTarget(false); Codex.setMode(false);}

    // Saves queued glosses
    function writeGlosses(){
        var queued=queued_glosses;
        // Copy the persistent data queue into the memory queue
        if (Codex.persist) {
            var lqueued=fdjtState.getLocal("queued("+Codex.refuri+")",true);
            if (lqueued) {
                var i=0, lim=lqueued.length; while (i<lim) {
                    var uuid=lqueued[i++];
                    queued.push(uuid); queued_data[uuid]=
                        fdjtState.getLocal("params("+uuid+")");}}}
        if (queued.length===0) {
            fdjtState.dropLocal("queued("+Codex.refuri+")");
            return;}
        var ajax_uri=getChild(fdjtID("CODEXADDGLOSSPROTOTYPE"),"form").
            getAttribute("ajaxaction");
        var i=0; var lim=queued.length; var pending=[];
        while (i<lim) {
            var uuid=queued[i++]; var params=queued_data[uuid];
            if (!(params)) continue;
            else pending.push(uuid);
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
            fdjtState.setLocal("queued("+Codex.refuri+")",pending,true);
        else fdjtState.dropLocal("queued("+Codex.refuri+")");
        if ((pending)&&(pending.length>0)) return pending;
        else return false;}
    Codex.writeGlosses=writeGlosses;
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
