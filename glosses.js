/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/glosses.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

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
/* jshint browser: true */
/* global Codex: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
// var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
// var Codex=((typeof Codex !== "undefined")?(Codex):({}));
// var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
// var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

(function () {
    "use strict";

    var fdjtString=fdjt.String;
    var fdjtState=fdjt.State;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var RefDB=fdjt.RefDB;
    var Ref=fdjt.Ref;
    var fdjtID=fdjt.ID;
    var cxID=Codex.ID;

    var addClass=fdjtDOM.addClass;
    var hasClass=fdjtDOM.hasClass;
    var dropClass=fdjtDOM.dropClass;
    var swapClass=fdjtDOM.swapClass;
    var getParent=fdjtDOM.getParent;
    var hasParent=fdjtDOM.hasParent;
    var getChildren=fdjtDOM.getChildren;
    var getChild=fdjtDOM.getChild;
    var getInput=fdjtDOM.getInput;
    var getInputs=fdjtDOM.getInputs;
    var getInputFor=fdjtDOM.getInputFor;

    var setCheckSpan=fdjtUI.CheckSpan.set;

    var glossmodes=Codex.glossmodes;

    var cxicon=Codex.icon;

    var getTarget=Codex.getTarget;

    var getGlossTags=Codex.getGlossTags;

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
        if ((!(match))||(match.length===0)||(!(match[0])))
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
        var div=getParent(form,".codexglossform");
        var input=false;
        var detail_elt=getInput(form,"DETAIL");
        if (!(form)) return;
        var frag=fdjtDOM.getInput(form,"FRAG");
        var uuid=fdjtDOM.getInput(form,"UUID");
        if ((Codex.Trace.mode)||(Codex.Trace.glossing)) {
            fdjtLog("setGlossMode %o%s: #%s #U%s",
                    mode,((toggle)?(" (toggle)"):("")),
                    ((frag)&&(frag.value)),
                    ((uuid)&&(uuid.value)));}
        if ((toggle)&&(mode===form.className)) mode=false;
        if (mode) addClass(div,"focused");
        if (form.className==="editdetail") {
            detail_elt.value=fdjt.ID("CODEXDETAILTEXT").value;}
        if (!(mode)) {
            dropClass(form,glossmodes);
            dropClass("CODEXHUD",/\bgloss\w+\b/);
            return;}
        if (mode==="addtag") input=fdjtID("CODEXTAGINPUT");
        else if (mode==="attach") {
            var upload_glossid=fdjtID("CODEXUPLOADGLOSSID");
            upload_glossid.value=uuid.value;
            var upload_itemid=fdjtID("CODEXUPLOADITEMID");
            upload_itemid.value=fdjtState.getUUID();
            input=fdjtID("CODEXATTACHURL");}
        else if (mode==="addoutlet") input=fdjtID("CODEXOUTLETINPUT");
        else if (mode==="editdetail") {
            input=fdjtID("CODEXDETAILTEXT");
            fdjt.ID("CODEXDETAILTEXT").value=detail_elt.value;}
        else {
            dropClass(form,glossmodes);
            dropClass("CODEXHUD",/\bgloss\w+\b/);
            return;}
        if ((Codex.Trace.mode)||(Codex.Trace.glossing))
            fdjtLog("setGlossMode gm=%s input=%o",mode,input);
        form.className=mode;
        swapClass("CODEXHUD",/\bgloss\w+\b/,"gloss"+mode);
        Codex.setHUD(true);
        if (input) Codex.setFocus(input);}
    Codex.setGlossMode=setGlossMode;

    // set the gloss target for a particular passage
    function getGlossForm(arg,response) {
        if (typeof arg === 'string')
            arg=fdjtID(arg)||Codex.glossdb.ref(arg)||false;
        if (!(arg)) return false;
        var gloss=((!(arg.nodeType))&&((arg.maker)||(arg.gloss))&&(arg));
        if (!(gloss)) response=false;
        else if ((arg.maker)&&(arg.maker!==Codex.user))
            response=true;
        else {}
        var passage=((gloss)?(cxID(gloss.frag)):(arg));
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
            form=getChildren(div,"form")[0];
            form.id=formid;
            form=setupGlossForm(form,passage,gloss,response||false);
            Codex.setupGestures(div);}
        else form=getChildren(div,"form")[0];
        if (gloss) {
            if (response) addClass(div,"glossreply");
            else {
                addClass(div,"glossedit");
                addClass(Codex.HUD,"glossediting");}}
        else addClass(div,"glossadd");
        if (form) return div; else return false;}
    Codex.getGlossForm=getGlossForm;
    
    function setupGlossForm(form,passage,gloss,response){
        var passageid=((passage.codexbaseid)||(passage.id));
        var info=Codex.docinfo[passageid];
        if (form.getAttribute("sbooksetup")) return false;
        if (!(info)) return false;
        form.onsubmit=submitGloss;
        getInput(form,"REFURI").value=Codex.refuri;
        getInput(form,"DOCTITLE").value=document.title;
        getInput(form,"DOCURI").value=document.location.href;
        getInput(form,"FRAG").value=passageid;
        if (info.wsnid) getInput(form,"WSNID").value=info.wsnid;
        if (Codex.user) getInput(form,"MAKER").value=Codex.user._id;
        if (Codex.mycopyid) getInput(form,"MYCOPYID").value=Codex.mycopyid;
        if (gloss) {
            var glossdate_elt=getChild(form,".glossdate");
            fdjtDOM(glossdate_elt,fdjtTime.shortString(gloss.created));
            glossdate_elt.title=fdjtTime.timeString(gloss.created);}
        var glossinput=getInput(form,"NOTE");
        var notespan=getChild(form,".notespan");
        if (glossinput) {
            fdjtDOM.addListener(glossinput,"blur",Codex.UI.glossform_focusout);
            glossinput.onkeypress=glossinput_onkeypress;
            glossinput.onkeydown=glossinput_onkeydown;
            glossinput.onfocus=glossinput_onfocus;
            if ((gloss)&&(!(response))) {
                glossinput.value=gloss.note||"";
                if (notespan) notespan.innerHTML=glossinput.value;}
            else glossinput.value="";}
        fdjtDOM.addListener(form,"focusin",Codex.UI.glossform_focusin);
        if (Codex.syncstamp)
            getInput(form,"SYNC").value=(Codex.syncstamp+1);
        var menu=getChild(form,".addglossmenu");
        fdjt.UI.TapHold(menu,{override: true});
        var loc=getInput(form,"LOCATION");
        var loclen=getInput(form,"LOCLEN");
        var tagline_elt=getInput(form,"TAGLINE");
        var respondsto=getInput(form,"RE");
        var thread=getInput(form,"THREAD");
        var uuidelt=getInput(form,"UUID");
        var detailelt=getInput(form,"DETAIL");
        var response_elt=getChild(form,"div.response");
        if ((response_elt)&&(response)&&(gloss)) {
            var maker_elt=getChild(response_elt,".respmaker");
            var date_elt=getChild(response_elt,".respdate");
            var note_elt=getChild(response_elt,".respnote");
            var makerinfo=Codex.sourcedb.ref(gloss.maker);
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
        if (tagline) tagline_elt.value=tagline;
        if (gloss) {
            var tags=getGlossTags(gloss);
            if (tags.length) {
                var i=0; var lim=tags.length;
                while (i<lim) addTag(form,tags[i++],false);}}
        if ((gloss)&&(!(response))&&(gloss.posted)) {
            var wasposted=getChild(form,".wasposted");
            if (wasposted) wasposted.disabled=false;
            var postgloss=getChild(form,".postgloss");
            fdjtUI.setCheckspan(postgloss,true);}
        if ((gloss)&&(!(response))&&(gloss.links)) {
            var links=gloss.links;
            for (var url in links) {
                if (url[0]==='_') continue;
                var urlinfo=links[url];
                var title;
                if (typeof urlinfo === 'string') title=urlinfo;
                else title=urlinfo.title;
                addLink(form,url,title);}}
        if ((gloss)&&(gloss.detail))
            detailelt.value=gloss.detail;
        if ((gloss)&&(gloss.share)) {
            var share=gloss.share;
            if (typeof share === 'string') share=[share];
            var share_i=0; var share_lim=share.length;
            while (share_i<share_lim)
                addTag(form,share[share_i++],"SHARE");}
        if ((!(response))&&(gloss)&&(gloss._id)) {
            uuidelt.value=gloss._id;}
        else uuidelt.value=fdjtState.getUUID(Codex.nodeid);
        if (gloss) {
            // Set the default outlets to unchecked before
            //  adding/setting the assigned outlets.
            resetOutlets(form);
            var shared=((gloss)&&(gloss.shared))||[];
            if (typeof shared === 'string') shared=[shared];
            var outlet_i=0, n_outlets=shared.length;
            while (outlet_i<n_outlets)
                addOutlet(form,shared[outlet_i++],"SHARE",true);
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

    /***** Setting the gloss target ******/

    // The target can be either a passage or another gloss
    function setGlossTarget(target,form,selecting){
        if (Codex.Trace.glossing)
            fdjtLog("setGlossTarget %o form=%o selecting=%o",
                    target,form,selecting);
        if (Codex.glosstarget) {
            dropClass(Codex.glosstarget,"codexglosstarget");}
        dropClass("CODEXHUD",/\bgloss\w+\b/);
        if (!(target)) {
            var cur=fdjtID("CODEXLIVEGLOSS");
            if (cur) cur.id=null;
            Codex.glosstarget=false;
            Codex.glossform=false;
            setSelecting(false);
            return;}
        var gloss=false;
        // Identify when the target is a gloss
        if ((typeof target === 'string')&&(cxID(target))) 
            target=cxID(target);
        else if ((typeof target === 'string')&&
                 (Codex.glossdb.probe(target))) {
            gloss=Codex.glossdb.ref(target);
            target=cxID(gloss.frag);}
        else if (target._db===Codex.glossdb) {
            gloss=target; target=cxID(gloss.frag);}
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
        // Reset this when we actually get a gloss
        Codex.select_target=false;
        addClass(target,"codexglosstarget");
        Codex.GoTo(target,"addgloss",true);
        Codex.setCloudCuesFromTarget(Codex.gloss_cloud,target);
        setGlossForm(form);
        // Clear current selection and set up new selection
        setSelecting(false);
        Codex.clearHighlights(target);
        if (selecting) setSelecting(selecting);
        else setSelecting(selectText(target));
        if ((gloss)&&(gloss.excerpt)&&(gloss.excerpt.length))
            Codex.selecting.setString(gloss.excerpt);
        else if (selecting) 
            updateExcerpt(form,selecting);
        else {}
        Codex.selecting.onchange=function(){
            updateExcerpt(form,this);};
        return form;}
    Codex.setGlossTarget=setGlossTarget;

    function setSelecting(selecting){
        if (Codex.selecting===selecting) return;
        else if (Codex.selecting) {
            if ((Codex.Trace.selection)||(Codex.Trace.glossing))
                fdjtLog("setSelecting, replacing %o with %o",
                        Codex.selecting,selecting);
            Codex.selecting.clear();}
        else {}
        Codex.selecting=selecting;}
    Codex.setSelecting=setSelecting;

    function hideGlossForm(form,flag){
        var wrapper=getParent(form,".codexglossform");
        if (typeof flag==="undefined") 
            flag=(!(hasClass(wrapper,"hiddenglossform")));
        if (flag) {
            addClass(wrapper,"hiddenglossform");
            Codex.setHUD(false);}
        else {
            dropClass(wrapper,"hiddenglossform");}}
    function showGlossForm(form){hideGlossForm(form,false);}

    function updateExcerpt(form,sel){
        var info=sel.getInfo();
        if ((Codex.Trace.glossing)||(Codex.Trace.selection))
            fdjtLog("Updating excerpt for %o from %o: %s",
                    form,sel,sel.getString());
        if (!(info)) {
            Codex.setExcerpt(form,false);
            return;}
        Codex.setExcerpt(form,info.string,info.off);
        var start_target=getTarget(info.start,true);
        var new_target=((start_target)&&
                        (!(hasParent(Codex.glosstarget,start_target)))&&
                        (new_target));
        if (new_target) {
            // When real_target is changed, we need to get a new EXOFF
            //  value, which we should probably get by passing real_target
            //  to a second call to getInfo (above)
            var input=fdjtDOM.getInput(form,"FRAG");
            input.value=new_target.id;
            if ((sel)&&(typeof info.off === "number")) {
                var offinput=fdjtDOM.getInput(form,"EXOFF");
                var newoff=sel.getOffset(new_target);
                offinput.value=newoff;}}
        showGlossForm(form);}

    function selectText(passages){
        if (passages.nodeType) passages=[passages];
        var dups=[];
        var i=0, lim=passages.length;
        while (i<lim) dups=dups.concat(Codex.getDups(passages[i++]));
        if ((Codex.Trace.selection)||(Codex.Trace.glossing))
            fdjtLog("selectText %o, dups=%o",passages,dups);
        return new fdjt.UI.TextSelect(
            dups,{ontap: gloss_selecting_ontap,
                  fortouch: Codex.touch,
                  holdthresh: 250,
                  movethresh: 250});}
    Codex.UI.selectText=selectText;

    function gloss_selecting_ontap(evt){
        evt=evt||event;
        if ((Codex.Trace.selection)||(Codex.Trace.glossing)||
            (Codex.Trace.gestures))
            fdjtLog("gloss_selecting_ontap %o, mode=%o, livegloss=%o",
                    evt,Codex.mode,fdjt.ID("CODEXLIVEGLOSS"));
        if (Codex.mode!=="addgloss") {
            Codex.setMode("addgloss");
            fdjtUI.cancel(evt);}
        else {
            var live_gloss=fdjt.ID("CODEXLIVEGLOSS");
            hideGlossForm(live_gloss);
            fdjtUI.cancel(evt);
            return;}}

    function setGlossForm(form){
        var cur=fdjtID("CODEXLIVEGLOSS");
        if (cur) cur.id=null;
        if (!(form)) {
            Codex.glossform=false;
            return;}
        form.id="CODEXLIVEGLOSS";
        if (form!==cur) hideGlossForm(cur,true);
        showGlossForm(form);
        if ((Codex.glossform)&&
            (Codex.glossform.className==="editdetail")) {
            var oldform=Codex.glossform;
            var detail_elt=getInput(oldform,"DETAIL");
            detail_elt.value=fdjt.ID("CODEXDETAILTEXT").value;
            detail_elt=getInput(form,"DETAIL");
            fdjt.ID("CODEXDETAILTEXT").value=detail_elt.value;}
        Codex.glossform=form;
        var syncelt=getInput(form,"SYNC");
        syncelt.value=(Codex.syncstamp+1);
        /* Do completions based on those input's values */
        Codex.share_cloud.complete();
        Codex.gloss_cloud.complete();}
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
                outlet=Codex.sourcedb.ref(outlet);
            else {
                outlet={name: outlet};
                spanspec="span.checkspan.email";
                if (!(formvar)) formvar="EMAIL";}}
        else if (outlet.nodeType) {
            if (!(formvar)) formvar="NETWORK";
            outlet_id=outlet.getAttribute("data-value");
            outlet={name: outlet.getAttribute("data-key")||outlet_id};}
        else {}
        if (!(formvar)) formvar="SHARE";
        var inputs=getInputs(form,formvar);
        var i=0; var lim=inputs.length;
        while (i<lim) {
            if (inputs[i].value===outlet_id) {
                var current_checkspan=getParent(inputs[i],".checkspan");
                setCheckSpan(current_checkspan,checked);
                return current_checkspan;}
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
        var wrapper=getParent(form,".codexglossform");
        var excerpt_span=getChild(form,'.excerpt');
        var input=getInput(form,'EXCERPT'), exoff=getInput(form,'EXOFF');
        if ((!(excerpt))||(fdjtString.isEmpty(excerpt))) {
            input.value=""; exoff.value="";
            input.disabled=exoff.disabled=true;
            if (excerpt_span) excerpt_span.innerHTML="";}
        else {
            input.disabled=exoff.disabled=false;
            input.value=excerpt;
            if (typeof off === "number") exoff.value=off;
            else {exoff.value="";exoff.disabled=true;}
            if (excerpt_span) excerpt_span.innerHTML=
                trim_excerpt(excerpt);}
        updateForm(form);
        addClass(wrapper,"modified");
        return;}
    Codex.setExcerpt=setExcerpt;

    function trim_excerpt(string,lim){
        var len=string.length; if (!(lim)) lim=20; 
        if (len<lim) return string;
        var words=string.split(/\s+/), nwords=words.length;
        if (words.length<3)
            return (string.slice(0,Math.floor(lim/2))+"..."+
                    string.slice(Math.floor(len-(lim/2))));
        var left=1, left_len=words[0].length+1;
        var right=nwords-2, right_len=words[nwords-1].length+1;
        while ((left<right)&&((left_len+right_len)<lim)) {
            left_len+=words[left++].length;
            right_len+=words[right--].length;}
        return words.slice(0,left).join(" ")+"..."+
            words.slice(right).join(" ");}

    /***** Adding tags ******/

    function addTag(form,tag,varname,checked,knodule) {
        // fdjtLog("Adding %o to tags for %o",tag,form);
        var prefix=false;
        if (!(tag)) tag=form;
        if (tag.prefix) {prefix=tag.prefix; tag=tag.tag;}
        if (form.tagName!=='FORM')
            form=getParent(form,'form')||form;
        if (!(knodule)) knodule=Codex.getMakerKnodule(Codex.user);
        if (typeof checked==="undefined") checked=true;
        var wrapper=getParent(form,".codexglossform");
        addClass(wrapper,"modified");
        var tagselt=getChild(form,'.tags');
        var title=false; var textspec='span.term';
        if (!(varname)) varname='TAGS';
        if ((tag.nodeType)&&(hasClass(tag,'completion'))) {
            if (hasClass(tag,'outlet')) {
                varname='SHARED'; textspec='span.outlet';}
            else if (hasClass(tag,'source')) {
                varname='SHARE'; textspec='span.source';}
            else {}
            if (tag.title) title=tag.title;
            tag=Codex.gloss_cloud.getValue(tag);}
        var ref=
            ((tag instanceof Ref)?(tag):
             ((typeof tag === 'string')&&
              (knodule.handleSubjectEntry(tag))));
        var text=
            ((ref)?
             (((ref.toHTML)&&(ref.toHTML()))||
              ref.name||ref.dterm||ref.title||ref.norm||
              ((typeof ref.EN === "string")||(ref.EN))||
              ((ref.EN instanceof Array)||(ref.EN[0]))||
              ref._qid||ref._id):
             (typeof tag === "string")?(tag):
             (tag.toString()));
        var tagval=tag;
        if (ref) {
            if (ref.knodule===knodule) tagval=ref.dterm;
            else tagval=ref._qid||ref.getQID();}
        if (prefix) tagval=prefix+tagval;
        if ((ref)&&(ref._db===Codex.sourcedb)) varname='SHARED';
        var checkspans=getChildren(tagselt,".checkspan");
        var i=0; var lim=checkspans.length;
        while (i<lim) {
            var cspan=checkspans[i++];
            if (((cspan.getAttribute("data-varname"))===varname)&&
                ((cspan.getAttribute("data-tagval"))===tagval)) {
                if (checked) addClass(cspan,"waschecked");
                return cspan;}}
        var span=fdjtUI.CheckSpan("span.checkspan",varname,tagval,checked);
        if (checked) addClass(span,"waschecked");
        if (title) span.title=title;
        span.setAttribute("data-varname",varname);
        span.setAttribute("data-tagval",tag);
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

    /* Text handling for the gloss text input */

    // An inline tag is of the form #<txt> or @<txt> where <txt> is
    //  either
    //  1. a word without spaces or terminal punctuation
    //  2. a string wrapped in delimiters, including
    //      "xx" 'yy' /zz/ [ii] (jj) {kk} «aa»
    var tag_delims={"\"": "\"", "'": "'", "/": "/","<":">",
                    "[": "]","(":")","{":"}","«":"»"};
    var tag_ends=/(\s|["'\/\[(<{}>)\]«»])/g;
    
    // Keep completion calls from clobbering one another
    var glossinput_timer=false;
    
    // Find the tag overlapping pos in string
    // Return a description of the tag
    function findTag(string,pos,partialok){
        if ((string)&&(string.length)&&(pos>0)) {
            var space=false, start=pos-1, delim=false, need=false;
            var c=string[start], pc=string[start-1], cstart=start;
            while (start>=0) {
                if (pc==='\\') {}
                else if (/\s/.test(c)) space=start;
                else if ((c==='@')||(c==='#')) break;
                else if (start===0) return false;
                start--; c=pc; pc=string[start-1];}
            var prefix=string[start];
            var sc=string[start+1], end=string.length;
            if (tag_delims[sc]) {
                var matching=tag_delims[sc]; delim=sc; cstart=start+2;
                var match_off=string.slice(start+2).indexOf(matching);
                if (match_off<0) {
                    if (partialok) {end=pos; need=matching;}
                    else return false;}
                else end=start+2+match_off;
                if (end<pos) return false;}
            else if (space) return false;
            else {
                var end_off=string.slice(start).search(tag_ends);
                if (end_off>0) end=start+end_off;
                cstart=start+1;}
            var result={text: string.slice(start,end),
                        start: start,end: end,pos: pos,prefix: prefix,
                        content: (((delim)&&(need))?(string.slice(start+2,end)):
                                  (delim)?(string.slice(start+2,end-1)):
                                  (string.slice(start+1,end)))};
            if (delim) result.delim=delim;
            if ((delim)&&(partialok)) result.needs=tag_delims[delim];
            return result;}
        else return false;}
    Codex.findTag=findTag;

    function tagclear(input_elt,pos){
        var text=input_elt.value;
        if (!(pos)) pos=input_elt.selectionStart;
        var info=findTag(text,pos);
        if (info) {
            input_elt.value=
                text.slice(0,info.start)+text.slice(info.end);}}

    function glossinput_onfocus(evt){
        var target=fdjtUI.T(evt);
        var text=target.value;
        var pos=target.selectionStart;
        var taginfo=findTag(text,pos);
        if (!(taginfo)) return;
        Codex.UI.glossform_focus(evt);
        if (glossinput_timer) clearTimeout(glossinput_timer);
        glossinput_timer=setTimeout(function(){glosstag_complete(target);},150);}

    function glossinput_onkeypress(evt){
        var target=fdjtUI.T(evt), form=getParent(target,"FORM");
        var text=target.value, pos=target.selectionStart||0;
        var ch=evt.charCode, charstring=String.fromCharCode(ch);
        var taginfo=findTag(text,pos,true);
        if (ch!==13) addClass(getParent(form,".codexglossform"),"focused");
        if (ch===13) {
            if (taginfo) {
                // Remove tag text
                target.value=text.slice(0,taginfo.start)+
                    text.slice(taginfo.end);
                // Add a selection or tag as appropriate
                glosstag_done(target,taginfo.content,evt.ctrlKey,
                              taginfo.prefix==="@");
                fdjt.UI.cancel(evt);}
            else if (evt.shiftKey) {
                target.value=text.slice(0,pos)+"\n"+text.slice(pos);
                target.selectionStart++;
                return fdjtUI.cancel(evt);}
            else {
                fdjtUI.cancel(evt);
                submitGloss(form);}}
        else if (!(taginfo)) {}
        else if (tag_ends.test(charstring)) {
            // Handles tag closing, which is an implicit add tag
            taginfo=findTag(text,pos,true);
            if (!(taginfo)) return;
            else if (taginfo.needs===charstring) {
                target.value=text.slice(0,taginfo.start)+
                    text.slice(taginfo.end);
                glosstag_done(target,taginfo.content,evt.ctrlKey,
                              taginfo.prefix==="@");
                fdjtUI.cancel(evt);}
            else {}
            return;}
        else {
            if (glossinput_timer) clearTimeout(glossinput_timer);
            glossinput_timer=setTimeout(function(){
                glosstag_complete(target);},
                                        150);}}

    function glossinput_onkeydown(evt){
        var ch=evt.keyCode, target=fdjtUI.T(evt);
        if (ch===27) {
            Codex.cancelGloss(); fdjtUI.cancel(evt);
            return;}
        else if ((ch===9)||(ch===13)) {
            var form=getParent(target,"FORM"), text=target.value;
            var pos=target.selectionStart||0, taginfo=findTag(text,pos,true);
            var cloud=((taginfo.prefix==="@")?(Codex.share_cloud):(Codex.gloss_cloud));
            if (!(taginfo)) return;
            else if (ch===9) {
                var content=taginfo.content;
                cloud.complete(content);
                if ((cloud.prefix)&&(cloud.prefix!==content)) {
                    var replace_start=taginfo.start+((taginfo.delim)?(2):(1));
                    var replace_end=taginfo.end-((taginfo.needs)?(0):(1));
                    if (cloud.prefix.search(/\s/)>=0)
                        target.value=text.slice(0,replace_start)+
                        ((taginfo.delim)?(""):("\""))+cloud.prefix+
                        ((taginfo.needs)?(taginfo.needs):(""))+
                        text.slice(replace_end);
                    else target.value=
                        text.slice(0,replace_start)+cloud.prefix+text.slice(replace_end);
                    setTimeout(function(){
                        Codex.UI.updateScroller("CODEXGLOSSCLOUD");},
                               100);
                    return;}
                else if (evt.shiftKey) cloud.selectPrevious();
                else cloud.selectNext();
                fdjtUI.cancel(evt);}
            else if (cloud.selection) {
                Codex.addTag2Form(form,cloud.selection);
                target.value=text.slice(0,taginfo.start)+text.slice(taginfo.end);
                dropClass("CODEXHUD",/gloss(tagging|tagoutlet)/g);
                setTimeout(function(){cloud.complete("");},10);
                cloud.clearSelection();
                fdjtUI.cancel(evt);}
            else {}}
        else if ((ch===8)||(ch===46)||((ch>=35)&&(ch<=40))) {
            // These may change content, so we update the completion state
            if (glossinput_timer) clearTimeout(glossinput_timer);
            glossinput_timer=setTimeout(function(){glosstag_complete(target);},150);}}

    function glosstag_complete(input_elt){
        var text=input_elt.value;
        var pos=input_elt.selectionStart||0;
        var taginfo=findTag(text,pos,true);
        if (taginfo) {
            var completions;
            var isoutlet=(taginfo.prefix==="@");
            if (isoutlet) swapClass("CODEXHUD",/gloss(tagging|tagoutlet)/g,"glosstagoutlet");
            else swapClass("CODEXHUD",/gloss(tagging|tagoutlet)/g,"glosstagging");
            if (isoutlet) completions=Codex.share_cloud.complete(taginfo.content);
            else completions=Codex.gloss_cloud.complete(taginfo.content);
            if (Codex.Trace.glossing)
                fdjtLog("Got %d completions for %s",
                        completions.length,taginfo.content);}
        else dropClass("CODEXHUD",/gloss(tagging|addoutlet)/g);}

    function glosstag_done(input_elt,tagtext,personal,isoutlet){
        var form=getParent(input_elt,"FORM"), tag=false;
        if ((!(isoutlet))&&(personal)) 
            tag=Codex.knodule.def(tagtext);
        else if (tagtext.indexOf('|')>0) {
            if (isoutlet) 
                fdjtLog.warn("Can't define outlets (sources) from %s",tagtext);
            else tag=Codex.knodule.def(tagtext);}
        else {
            var cloud=((isoutlet)?(Codex.share_cloud):(Codex.gloss_cloud));
            var completions=cloud.complete(tagtext);
            if (completions.length===0) {}
            else if (completions.length===1) tag=completions[0];
            else {}
            if ((isoutlet)&&(!(tag))) 
                fdjtLog.warn("Unknown outlet %s",tagtext);
            else if (isoutlet) addOutlet(form,tag);
            else if (!(tag)) {
                tag=Codex.knodule.ref(tagtext);
                if (tag) addTag(form,tag);
                else addTag(form,tagtext);}
            else addTag(form,tag);}
        dropClass("CODEXHUD",/gloss(tagging|addoutlet)/);}
    
    function getTagString(span,content){
        var tagval=span.getAttribute("data-tagval");
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

    function handleTagInput(tagstring,form,exact){
        var isoutlet=(tagstring[0]==="@");
        var cloud=((isoutlet)?(Codex.share_cloud):(Codex.gloss_cloud));
        var text=(((tagstring[0]==='@')||(tagstring[0]==='#'))?
            (tagstring.slice(1)):(tagstring));
        var completions=cloud.complete(text);
        var std=stdspace(text);
        if (isoutlet) {
            var oc=[]; var j=0, jlim=completions.length; while (j<jlim) {
                var c=completions[j++];
                if (hasClass(c,"outlet")) oc.push(c);}
            completions=oc;}
        if ((!(completions))||(completions.length===0)) {
            if (isoutlet) addOutlet(form,std); // Should probably just warn
            else addTag(form,std);
            cloud.complete("");
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
                    var mc=completions[i++];
                    if (mc!==completion) {completion=false; break;}}}
            if ((completion)&&(completion===completions[0])) {
                var ks=Codex.gloss_cloud.getKey(completions.matches[0]);
                if ((exact)?(ks.toLowerCase()!==std.toLowerCase()):
                    (ks.toLowerCase().search()!==0)) {
                    // When exact is true, count on exact matches;
                    // even if it is false, don't except non-prefix
                    // matches
                    addTag(form,std);
                    Codex.gloss_cloud.complete("");
                    return std;}}
            if (completion) {
                var span=addTag(form,completion);
                Codex.gloss_cloud.complete("");
                return getTagString(span,Codex.gloss_cloud.getKey(completion));}
            else {
                addTag(form,std);
                Codex.gloss_cloud.complete("");
                return std;}}}
    Codex.handleTagInput=handleTagInput;

    function get_addgloss_callback(form,keep,uri){
        return function(req){
            return addgloss_callback(req,form,keep,uri);};}

    function addgloss_callback(req,form,keep){
        if ((Codex.Trace.network)||(Codex.Trace.glossing))
            fdjtLog("Got AJAX gloss response %o from %o",req,req.uri);
        if (Codex.Trace.savegloss)
            fdjtLog("Gloss %o successfully added (status %d) to %o",
                    getInput(form,"UUID").value,req.status,
                    getInput(form,"FRAG").value);
        dropClass(form.parentNode,"submitting");
        if (keep)
            addClass(form.parentNode,"submitdone");
        else addClass(form.parentNode,"submitclose");
        var json=JSON.parse(req.responseText);
        var ref=Codex.glossdb.Import(
            // item,rules,flags
            json,false,((RefDB.REFINDEX)|(RefDB.REFSTRINGS)|(RefDB.REFLOAD)));
        var reps=document.getElementsByName(ref._id);
        var i=0, lim=reps.length;
        while (i<lim) {
            var rep=reps[i++];
            if (hasClass(rep,"codexcard")) {
                var new_card=Codex.renderCard(ref);
                if (new_card) fdjtDOM.replace(rep,new_card);}}
        ref.save();
        /* Turn off the target lock */
        if ((form)&&(!(keep))) {
            setTimeout(function(){
                if (hasClass(form.parentNode,"submitclose")) {
                    if ((form.parentNode)&&(form.parentNode))
                        fdjtDOM.remove(form.parentNode);
                    setGlossTarget(false);
                    Codex.setTarget(false);
                    Codex.setMode(false);}},
                       3000);}
        else if (form)
            setTimeout(function(){
                dropClass(form.parentNode,"submitdone");},
                       3000);
        else {}}

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
                    span,Codex.gloss_cloud.getKey(completion));
                var input=getInput(form,"NOTE");
                if ((input)&&(tagstring)) tagclear(input);}}
        fdjtUI.cancel(evt);}
    Codex.UI.handlers.glosscloud_ontap=glosscloud_ontap;

    /***** The Outlet Cloud *****/

    function sharecloud_ontap(evt){
        var target=fdjtUI.T(evt);
        var completion=getParent(target,'.completion');
        if (completion) {
            var live=fdjtID("CODEXLIVEGLOSS");
            var form=((live)&&(getChild(live,"form")));
            var value=completion.getAttribute("data-value");
            if (hasClass(completion,"source")) {
                if (value) addOutlet(form,Codex.sourcedb.ref(value),"SHARE");}
            else if (hasClass(completion,"network")) 
                addOutlet(form,completion,"NETWORK");
            else if (hasClass(completion,"email")) 
                if (value) addOutlet(form,completion,"EMAIL");
            else addOutlet(form,completion);}
        fdjtUI.cancel(evt);}
    Codex.UI.sharecloud_ontap=sharecloud_ontap;

    /***** Saving (submitting/queueing) glosses *****/

    var login_message=false;

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
                    fdjt.ID("CODEXDETAILTEXT").value;
                fdjt.ID("CODEXDETAILTEXT").value="";}}
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
            note_input.value="";}
        if ((!(login_message))&&
            ((!(navigator.onLine))||(!(Codex.connected)))) {
            var choices=[];
            if (navigator.onLine) 
                choices.push({label: "Login",
                              isdefault: true,
                              handler: function(){
                                  setTimeout(function(){Codex.setMode("login");},0);
                                  var resubmit=function(){submitGloss(arg,keep);};
                                  if (Codex._onconnect) Codex._onconnect.push(resubmit);
                                  else Codex._onconnect=[resubmit];
                                  login_message=true;}});
            if ((Codex.user)&&(Codex.persist)) 
                choices.push({label: "Queue",
                              isdefault: ((!(navigator.onLine))&&
                                          (Codex.cacheglosses)),
                              handler: function(){
                                  if (Codex.nocache)
                                      Codex.setConfig("cacheglosses",true);
                                  login_message=true;
                                  if (!((navigator.onLine)&&(Codex.connected)))
                                      queueGloss(arg,false,keep);
                                  else submitGloss(arg,keep);}});
            else {
                choices.push({label: "Cache",
                              isdefault: ((!(navigator.onLine))&&
                                          (Codex.cacheglosses)),
                              handler: function(){
                                  if (Codex.nocache)
                                      Codex.setConfig("cacheglosses",true,true);
                                  login_message=true;
                                  queueGloss(arg,false,keep);}});
                if (Codex.nocache)
                    choices.push({label: "Lose",
                                  isdefault:((!(navigator.onLine))&&
                                             (Codex.nocache)),
                                  handler: function(){
                                      tempGloss(form); login_message=true;}});}
            choices.push({label: "Cancel",
                          handler: function(){
                              fdjtDOM.remove(form.parentNode);
                              setGlossTarget(false);
                              Codex.setTarget(false);
                              Codex.setMode(false);}});
            fdjtUI.choose(choices,
                          ((navigator.onLine)&&(!(Codex.user))&&
                           ([fdjtDOM("p.smaller",
                                    "This book isn't currently associated with an sBooks account, ",
                                    "so any highlights or glosses you add will not be permanently saved ",
                                    "until you login."),
                             fdjtDOM("p.smaller",
                                     "You may either login now, cache your changes ",
                                     "on this machine until you do login, ",
                                     "lose your changes when this page closes, ",
                                     "or cancel the change you're about to make.")])),
                          (((navigator.onLine)&&(Codex.user)&&
                            ([fdjtDOM("p.smaller",
                                     "You aren't currently logged into your sBooks account from ",
                                     "this machine, so any highlights or glosses you add won't ",
                                     "be saved until you do."),
                              fdjtDOM("p.smaller","In addition, you won't get updated glosses from ",
                                      "your networks or layers."),
                              fdjtDOM("p.smaller",
                                      "You may either login now, queue any changes you make until ",
                                     "you do login, or cancel the change you were trying to make.")]))),
                          ((!(navigator.onLine))&&(Codex.nocache)&&
                           ([fdjtDOM("p.smaller",
                                    "You are currently offline and have elected to not save ",
                                    "highlights or glosses locally on this computer."),
                             fdjtDOM("p.smaller",
                                    "You can either queue your changes by storing information locally, ",
                                    "lose your changes when this page closes,",
                                    "or cancel the change you were about to make.")])));
            return;}
        var sent=((navigator.onLine)&&(Codex.connected)&&(Codex.user)&&
                  (fdjt.Ajax.onsubmit(form,get_addgloss_callback(form,keep))));
        if (!(sent)) queueGloss(form,((arg)&&(arg.type)&&(arg)),keep);
        else dropClass(div,"modified");}
    Codex.submitGloss=submitGloss;

    function cancelGloss_handler(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
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
        var mode=form.className; var i, lim;
        swapClass(proto,glossmodes,mode);
        // Save post setting
        var post=getInput(form,"POSTGLOSS");
        var proto_post=getInput(form,"POSTGLOSS");
        setCheckSpan(proto_post,post.checked);
        // Save network settings
        var networks=getInputs(form,"NETWORKS");
        i=0; lim=networks.length; while (i<lim) {
            var network_input=networks[i++];
            var proto_input=getInputFor(form,"NETWORKS",network_input.value);
            setCheckSpan(proto_input,network_input.checked);}
        // Save outlets
        clearOutlets(proto);
        var shared=getChild(form,".outlets");
        var inputs=getChildren(shared,"INPUT");
        // Here's the logic: we save all checked outlets and any
        // others up to 5.
        i=0; lim=inputs.length; var n_others=0; while (i<lim) {
            var input=inputs[i++];
            if ((input.checked)||(n_others<=5)) {
                var checkspan=addOutlet(
                    proto,input.value,input.name,input.checked);
                if (input.checked) addClass(checkspan,"waschecked");
                else n_others++;}}}

    // These are for glosses saved only in the current session,
    // without using local storage.
    var queued_data={};

    // Queues a gloss when offline
    function queueGloss(form,evt,keep){
        // We use the JSON to update the local database and save the
        // params to send when we get online
        var json=fdjt.Ajax.formJSON(form,true);
        var params=fdjt.Ajax.formParams(form);
        var queued=Codex.queued;
        queued.push(json.uuid);
        if (Codex.cacheglosses) {
            fdjtState.setLocal("codex.params("+json.uuid+")",params);
            fdjtState.setLocal("codex.queued("+Codex.refuri+")",queued,true);}
        else queued_data[json.uuid]=params;
        // Now save it to the in-memory database
        var glossdata=
            {refuri: json.refuri,frag: json.frag,
             maker: json.user,_id: json.uuid,uuid: json.uuid,
             qid: json.uuid,gloss: json.uuid,
             created: ((json.created)||(fdjtTime()))};
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
        Codex.glossdb.Import(glossdata,false,false,true);
        if (evt) fdjtUI.cancel(evt);
        dropClass(form.parentNode,"submitting");
        /* Turn off the target lock */
        if (!(keep)) {
            // Clear the UUID
            clearGlossForm(form);
            setGlossTarget(false);
            Codex.setTarget(false);
            Codex.setMode(false);}}

    // Creates a gloss which will go away when the page closes
    function tempGloss(form,evt){
        // We use the JSON to update the local database and save the
        // params to send when we get online
        var json=fdjt.Ajax.formJSON(form,true);
        // save it to the in-memory database
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
        Codex.glossdb.Import(glossdata,false,false,true);
        // Clear the UUID
        clearGlossForm(form);
        if (evt) fdjtUI.cancel(evt);
        dropClass(form.parentNode,"submitting");
        /* Turn off the target lock */
        setGlossTarget(false); Codex.setTarget(false); Codex.setMode(false);}

    // Saves queued glosses
    function writeQueuedGlosses(){
        if (Codex.queued.length) {
            var ajax_uri=getChild(fdjtID("CODEXADDGLOSSPROTOTYPE"),"form").
                getAttribute("ajaxaction");
            var queued=Codex.queued; var glossid=queued[0];
            var post_data=((Codex.nocache)?((queued_data[glossid])):
                           (fdjtState.getLocal("codex.params("+glossid+")")));
            if (post_data) {
                var req=new XMLHttpRequest();
                req.open('POST',ajax_uri);
                req.withCredentials='yes';
                req.onreadystatechange=function () {
                    if ((req.readyState === 4) &&
                        (req.status>=200) && (req.status<300)) {
                        fdjtState.dropLocal("codex.params("+glossid+")");
                        var pending=Codex.queued;
                        if ((pending)&&(pending.length)) {
                            var pos=pending.indexOf(glossid);
                            if (pos>=0) {
                                pending.splice(pos,pos);
                                if (Codex.cacheglosses)
                                    fdjtState.setLocal("codex.queued("+Codex.refuri+")",pending,true);
                                Codex.queued=pending;}}
                        addgloss_callback(req,false,false);
                        if (pending.length) setTimeout(writeQueuedGlosses,200);
                        fdjtState.dropLocal("codex.queued("+Codex.refuri+")");}
                    else if (req.readyState===4) {
                        Codex.setConnected(false);}
                    else {}};
                try {
                    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    req.send(post_data);}
                catch (ex) {Codex.setConnected(false);}}}}
    Codex.writeQueuedGlosses=writeQueuedGlosses;
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
