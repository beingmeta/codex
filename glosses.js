/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/glosses.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file implements the interface for adding and editing **glosses**,
   which are annotations associated with text passages in a document.

   This file is part of metaBook, a Javascript/DHTML web application for reading
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
/* global metaBook: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
// var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
// var metaBook=((typeof metaBook !== "undefined")?(metaBook):({}));
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

    var mB=metaBook;
    var mbID=mB.ID;
    var Trace=mB.Trace;

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

    var glossmodes=mB.glossmodes;

    var mbicon=mB.icon;

    var getTarget=mB.getTarget;

    var getGlossTags=mB.getGlossTags;

    var uri_prefix=/(http:)|(https:)|(ftp:)|(urn:)/;

    // The gloss mode is stored in two places:
    //  * the class of the gloss FORM element
    //  * as the class gloss+mode on METABOOKHUD (e.g. glossaddtag)
    function getGlossMode(arg){
        if (!(arg)) arg=fdjtID("METABOOKLIVEGLOSS");
        if (typeof arg === 'string') arg=fdjtID(arg);
        if ((!(arg))||(!(arg.nodeType))) return false;
        if (arg.tagName!=="FORM") arg=getChild(arg,"FORM");
        var classname=arg.className;
        var match=glossmodes.exec(classname);
        if ((!(match))||(match.length===0)||(!(match[0])))
            return false;
        else return match[0];}
    metaBook.getGlossMode=getGlossMode;

    function setGlossMode(mode,arg,toggle){
        if (!(arg)) arg=fdjtID("METABOOKLIVEGLOSS");
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
        if ((Trace.mode)||(Trace.glossing)) {
            fdjtLog("setGlossMode %o%s: #%s #U%s",
                    mode,((toggle)?(" (toggle)"):("")),
                    ((frag)&&(frag.value)),
                    ((uuid)&&(uuid.value)));}
        if ((toggle)&&(mode===form.className)) mode=false;
        if (mode) addClass(div,"focused");
        if (form.className==="editdetail") {
            detail_elt.value=fdjt.ID("METABOOKDETAILTEXT").value;}
        if (!(mode)) {
            dropClass(form,glossmodes);
            dropClass("METABOOKHUD",/\bgloss\w+\b/);
            dropClass("METABOOKHUD","openheart");
            return;}
        if (mode==="addtag") input=fdjtID("METABOOKTAGINPUT");
        else if (mode==="attach") {
            var upload_glossid=fdjtID("METABOOKUPLOADGLOSSID");
            upload_glossid.value=uuid.value;
            var upload_itemid=fdjtID("METABOOKUPLOADITEMID");
            upload_itemid.value=fdjtState.getUUID();
            input=fdjtID("METABOOKATTACHURL");}
        else if (mode==="addoutlet") input=fdjtID("METABOOKOUTLETINPUT");
        else if (mode==="editdetail") {
            input=fdjtID("METABOOKDETAILTEXT");
            fdjt.ID("METABOOKDETAILTEXT").value=detail_elt.value;}
        else {
            dropClass(form,glossmodes);
            dropClass("METABOOKHUD",/\bgloss\w+\b/);
            return;}
        if ((Trace.mode)||(Trace.glossing))
            fdjtLog("setGlossMode gm=%s input=%o",mode,input);
        form.className=mode;
        swapClass("METABOOKHUD",/\bgloss\w+\b/,"gloss"+mode);
        mB.setHUD(true);
        if ((mode)&&(/(editdetail|addtag|addoutlet)/.exec(mode)))
            addClass("METABOOKHUD","openheart");
        if (input) mB.setFocus(input);}
    metaBook.setGlossMode=setGlossMode;

    // set the gloss target for a particular passage
    function getGlossForm(arg,response) {
        if (typeof arg === 'string')
            arg=fdjtID(arg)||mB.glossdb.ref(arg)||false;
        if (!(arg)) return false;
        var gloss=((!(arg.nodeType))&&((arg.maker)||(arg.gloss))&&(arg));
        if (!(gloss)) response=false;
        else if ((arg.maker)&&(arg.maker!==mB.user))
            response=true;
        else {}
        var passage=((gloss)?(mbID(gloss.frag)):(arg));
        var passageid=((passage.baseid)||(passage.id));
        var formid=((gloss)?
                    ((response)?
                     ("METABOOKRESPONDGLOSS_"+gloss._id):
                     ("METABOOKEDITGLOSS_"+gloss._id)):
                    ("METABOOKADDGLOSS_"+passageid));
        var form=fdjtID(formid);
        var div=((form)&&(form.parentNode));
        var proto=fdjtID("METABOOKADDGLOSSPROTOTYPE");
        if (!(div)) {
            div=proto.cloneNode(true); div.id="";
            fdjtDOM(fdjtID("METABOOKGLOSSFORMS"),div);
            form=getChildren(div,"form")[0];
            form.id=formid;
            form=setupGlossForm(form,passage,gloss,response||false);
            mB.setupGestures(div);}
        else form=getChildren(div,"form")[0];
        if (gloss) {
            if (response) addClass(div,"glossreply");
            else {
                addClass(div,"glossedit");
                addClass(mB.HUD,"editgloss");}}
        else addClass(div,"glossadd");
        if (form) return div; else return false;}
    metaBook.getGlossForm=getGlossForm;
    
    function setupGlossForm(form,passage,gloss,response){
        var passageid=((passage.baseid)||(passage.id));
        var info=mB.docinfo[passageid];
        if (form.getAttribute("sbooksetup")) return false;
        if (!(info)) return false;
        form.onsubmit=submitGloss;
        getInput(form,"REFURI").value=mB.refuri;
        getInput(form,"DOCTITLE").value=document.title;
        getInput(form,"DOCURI").value=document.location.href;
        getInput(form,"FRAG").value=passageid;
        if (info.wsnid) getInput(form,"WSNID").value=info.wsnid;
        if (mB.user) getInput(form,"MAKER").value=mB.user._id;
        if (mB.mycopyid) getInput(form,"MYCOPYID").value=mB.mycopyid;
        if (gloss) {
            var glossdate_elt=getChild(form,".glossdate");
            fdjtDOM(glossdate_elt,fdjtTime.shortString(gloss.created));
            glossdate_elt.title=fdjtTime.timeString(gloss.created);}
        var glossinput=getInput(form,"NOTE");
        var notespan=getChild(form,".notespan");
        if (glossinput) {
            glossinput.onkeypress=glossinput_onkeypress;
            glossinput.onkeydown=glossinput_onkeydown;
            glossinput.onfocus=glossinput_onfocus;
            if ((gloss)&&(!(response))) {
                glossinput.value=gloss.note||"";
                if (notespan) notespan.innerHTML=glossinput.value;}
            else glossinput.value="";}
        if (mB.syncstamp)
            getInput(form,"SYNC").value=(mB.syncstamp+1);
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
            var makerinfo=mB.sourcedb.ref(gloss.maker);
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
        else uuidelt.value=fdjtState.getUUID(mB.nodeid);
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
            mB.setExcerpt(form,gloss.excerpt,gloss.exoff);
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
        if (Trace.glossing)
            fdjtLog("setGlossTarget %o form=%o selecting=%o",
                    target,form,selecting);
        if (mB.glosstarget) {
            dropClass(mB.glosstarget,"codexglosstarget");}
        dropClass("METABOOKHUD",/\bgloss\w+\b/);
        dropClass("METABOOKHUD","editgloss");
        if (!(target)) {
            var cur=fdjtID("METABOOKLIVEGLOSS");
            if (cur) cur.id="";
            mB.glosstarget=false;
            mB.glossform=false;
            setSelecting(false);
            return;}
        var gloss=false;
        // Identify when the target is a gloss
        if ((typeof target === 'string')&&(mbID(target))) 
            target=mbID(target);
        else if ((typeof target === 'string')&&
                 (mB.glossdb.probe(target))) {
            gloss=mB.glossdb.ref(target);
            target=mbID(gloss.frag);}
        else if (target._db===mB.glossdb) {
            gloss=target; target=mbID(gloss.frag);}
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
        mB.glosstarget=target;
        // Reset this when we actually get a gloss
        mB.select_target=false;
        addClass(target,"codexglosstarget");
        mB.GoTo(target,"addgloss",true);
        mB.setCloudCuesFromTarget(mB.gloss_cloud,target);
        setGlossForm(form);
        // Clear current selection and set up new selection
        setSelecting(false);
        mB.clearHighlights(target);
        if (selecting) setSelecting(selecting);
        else setSelecting(selectText(target));
        if ((gloss)&&(gloss.excerpt)&&(gloss.excerpt.length))
            mB.selecting.setString(gloss.excerpt);
        else if (selecting) 
            updateExcerpt(form,selecting);
        else {}
        mB.selecting.onchange=function(){
            updateExcerpt(form,this);};
        return form;}
    metaBook.setGlossTarget=setGlossTarget;

    function setSelecting(selecting){
        if (mB.selecting===selecting) return;
        else if (mB.selecting) {
            if ((Trace.selection)||(Trace.glossing))
                fdjtLog("setSelecting, replacing %o with %o",
                        mB.selecting,selecting);
            mB.selecting.clear();}
        else {}
        mB.selecting=selecting;}
    metaBook.setSelecting=setSelecting;

    function updateExcerpt(form,sel){
        var info=sel.getInfo();
        if ((Trace.glossing)||(Trace.selection))
            fdjtLog("Updating excerpt for %o from %o: %s",
                    form,sel,sel.getString());
        if (!(info)) {
            mB.setExcerpt(form,false);
            return;}
        mB.setExcerpt(form,info.string,info.off);
        var start_target=getTarget(info.start,true);
        var new_target=((start_target)&&
                        (!(hasParent(mB.glosstarget,start_target)))&&
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
                offinput.value=newoff;}}}

    function selectText(passages,opts){
        if (passages.nodeType) passages=[passages];
        var dups=[];
        var i=0, lim=passages.length;
        while (i<lim) dups=dups.concat(mB.getDups(passages[i++]));
        if ((Trace.selection)||(Trace.glossing))
            fdjtLog("selectText %o, dups=%o",passages,dups);
        return new fdjt.UI.TextSelect(
            dups,{ontap: gloss_selecting_ontap,
                  onrelease: ((opts)&&(opts.onrelease)),
                  onslip: ((opts)&&(opts.onslip)),
                  fortouch: mB.touch,
                  holdthresh: 150,
                  movethresh: 250});}
    metaBook.UI.selectText=selectText;

    function gloss_selecting_ontap(evt){
        evt=evt||window.event;
        if ((Trace.selection)||(Trace.glossing)||(Trace.gestures))
            fdjtLog("gloss_selecting_ontap %o, mode=%o, livegloss=%o",
                    evt,mB.mode,fdjt.ID("METABOOKLIVEGLOSS"));
        if (mB.mode!=="addgloss") 
            mB.setMode("addgloss",false);
        else if ((mB.modechange)&&
                 ((fdjtTime()-mB.modechange)<1500)) {}
        else mB.setHUD(false);
        fdjtUI.cancel(evt);
        return;}

    function setGlossForm(form){
        var cur=fdjtID("METABOOKLIVEGLOSS");
        if (cur) cur.id="";
        if (Trace.glossing)
            fdjtLog("setGlossForm %o <== %o",form,mB.glossform);
        if (!(form)) {
            mB.glossform=false;
            return;}
        form.id="METABOOKLIVEGLOSS";
        if ((mB.glossform)&&
            (mB.glossform.className==="editdetail")) {
            var oldform=mB.glossform;
            var detail_elt=getInput(oldform,"DETAIL");
            detail_elt.value=fdjt.ID("METABOOKDETAILTEXT").value;
            detail_elt=getInput(form,"DETAIL");
            fdjt.ID("METABOOKDETAILTEXT").value=detail_elt.value;}
        mB.glossform=form;
        var syncelt=getInput(form,"SYNC");
        syncelt.value=(mB.syncstamp+1);
        /* Do completions based on those input's values */
        mB.share_cloud.complete();
        mB.gloss_cloud.complete();}
    metaBook.setGlossForm=setGlossForm;

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
        if (Trace.glossing)
            fdjtLog(
                "addOutlet wrapper=%o form=%o outlet=%o formvar=%o checked=%o",
                wrapper,form,outlet,formvar,checked);
        var outletspan=getChild(form,".outlets");
        var outlet_id=((typeof outlet === 'string')?(outlet):(outlet._id));
        if (typeof outlet === 'string') {
            if ((outlet[0]==='@')||
                ((outlet[0]===':')&&(outlet[0]==='@')))
                outlet=mB.sourcedb.ref(outlet);
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
            fdjtDOM.Image(mbicon("redx",32,32),"img.redx","x"));
        if ((outlet.nick)&&(outlet.description))
            checkspan.title=outlet.name+": "+outlet.description;
        else if (outlet.description)
            checkspan.title=outlet.description;
        else checkspan.title=outlet.name;
        fdjtDOM(outletspan,checkspan," ");
        dropClass(outletspan,"empty");
        return checkspan;}
    mB.addOutlet2Form=addOutlet;

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
        var img=fdjtDOM.Image(mbicon("diaglink",64,64),"img");
        var anchor=fdjtDOM.Anchor(url,"a.glosslink",((title)||url));
        var checkbox=fdjtDOM.Checkbox("LINKS",linkval,true);
        var aspan=fdjtDOM("span.checkspan.ischecked.waschecked.anchor",
                          img,checkbox,anchor,
                          fdjtDOM.Image(mbicon("redx",32,32),"img.redx","x"));
        var wrapper=getParent(form,".codexglossform");
        if (Trace.glossing)
            fdjtLog(
                "addOutlet wrapper=%o form=%o url=%o title=%o",
                wrapper,form,url,title);
        addClass(wrapper,"modified");
        aspan.title=url; anchor.target='_blank';
        fdjtDOM(linkselt,aspan," ");
        dropClass(linkselt,"empty");
        updateForm(form);
        return aspan;}
    metaBook.addLink2Form=addLink;

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
        if ((Trace.glossing)||(Trace.selecting))
            fdjtLog("setExcerpt %o form=%o excerpt=%o off=%o",
                    wrapper,form,excerpt,off);
        updateForm(form);
        addClass(wrapper,"modified");
        return;}
    metaBook.setExcerpt=setExcerpt;

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
        if (!(knodule)) knodule=mB.getMakerKnodule(mB.user);
        if (typeof checked==="undefined") checked=true;
        var wrapper=getParent(form,".codexglossform");
        if (Trace.glossing)
            fdjtLog(
                "AddTag %o form=%o tag=%o var=%o checked=%o kno=%o",
                wrapper,form,tag,varname,checked,knodule);
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
            tag=mB.gloss_cloud.getValue(tag);}
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
        if ((ref)&&(ref._db===mB.sourcedb)) varname='SHARED';
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
            span,fdjtDOM.Image(mbicon("redx",32,32),"img.redx","x"));
        fdjtDOM.append(tagselt,span," ");
        dropClass(tagselt,"empty");
        updateForm(form);
        return span;}
    metaBook.addTag2Form=addTag;

    metaBook.setGlossNetwork=function(form,network,checked){
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
    metaBook.findTag=findTag;

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
        if ((Trace.glossing)||(Trace.gestures))
            fdjtLog("glossinput_onfocus %o text=%o pos=%o taginfo=%o",
                    evt,text,pos,taginfo);
        mB.UI.glossform_focus(evt);
        if (!(taginfo)) return;
        if (glossinput_timer) clearTimeout(glossinput_timer);
        glossinput_timer=setTimeout(function(){
            glosstag_complete(target);},150);}

    function glossinput_onkeypress(evt){
        var target=fdjtUI.T(evt), form=getParent(target,"FORM");
        var text=target.value, pos=target.selectionStart||0;
        var ch=evt.charCode, charstring=String.fromCharCode(ch);
        var taginfo=findTag(text,pos,true);
        if ((Trace.glossing)||(Trace.gestures>2))
            fdjtLog("glossinput_onkeypress '%o' %o text=%o pos=%o taginfo=%o",
                    ch,evt,text,pos,taginfo);
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
            mB.cancelGloss(); fdjtUI.cancel(evt);
            return;}
        else if ((ch===9)||(ch===13)) {
            var form=getParent(target,"FORM"), text=target.value;
            var pos=target.selectionStart||0, taginfo=findTag(text,pos,true);
            var cloud=((taginfo.prefix==="@")?
                       (mB.share_cloud):
                       (mB.gloss_cloud));
            if ((Trace.glossing)||(Trace.gestures>2))
                fdjtLog("glossinput_onkeydown '%o' %o taginfo=%o cloud=%o",
                        ch,evt,taginfo,cloud);
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
                        text.slice(0,replace_start)+cloud.prefix+
                        text.slice(replace_end);
                    setTimeout(function(){
                        mB.UI.updateScroller("METABOOKGLOSSCLOUD");},
                               100);
                    return;}
                else if (evt.shiftKey) cloud.selectPrevious();
                else cloud.selectNext();
                fdjtUI.cancel(evt);}
            else if (cloud.selection) {
                mB.addTag2Form(form,cloud.selection);
                target.value=text.slice(0,taginfo.start)+text.slice(taginfo.end);
                dropClass("METABOOKHUD",/gloss(tagging|tagoutlet)/g);
                setTimeout(function(){cloud.complete("");},10);
                cloud.clearSelection();
                fdjtUI.cancel(evt);}
            else {}}
        else if ((ch===8)||(ch===46)||((ch>=35)&&(ch<=40))) {
            // These may change content, so we update the completion state
            if (glossinput_timer) clearTimeout(glossinput_timer);
            glossinput_timer=setTimeout(function(){
                glosstag_complete(target);},150);}}

    function glosstag_complete(input_elt){
        var text=input_elt.value;
        var pos=input_elt.selectionStart||0;
        var taginfo=findTag(text,pos,true);
        if (taginfo) {
            var completions;
            var isoutlet=(taginfo.prefix==="@");
            if (isoutlet)
                swapClass(
                    "METABOOKHUD",/gloss(tagging|tagoutlet)/g,"glosstagoutlet");
            else swapClass(
                "METABOOKHUD",/gloss(tagging|tagoutlet)/g,"glosstagging");
            if (isoutlet)
                completions=mB.share_cloud.complete(taginfo.content);
            else completions=mB.gloss_cloud.complete(taginfo.content);
            if (Trace.glossing)
                fdjtLog("Got %d completions for %s",
                        completions.length,taginfo.content);}
        else dropClass("METABOOKHUD",/gloss(tagging|addoutlet)/g);}

    function glosstag_done(input_elt,tagtext,personal,isoutlet){
        var form=getParent(input_elt,"FORM"), tag=false;
        if ((!(isoutlet))&&(personal)) 
            tag=mB.knodule.def(tagtext);
        else if (tagtext.indexOf('|')>0) {
            if (isoutlet) 
                fdjtLog.warn("Can't define outlets (sources) from %s",tagtext);
            else tag=mB.knodule.def(tagtext);}
        else {
            var cloud=((isoutlet)?(mB.share_cloud):(mB.gloss_cloud));
            var completions=cloud.complete(tagtext);
            if (completions.length===0) {}
            else if (completions.length===1) tag=completions[0];
            else {}
            if ((isoutlet)&&(!(tag))) 
                fdjtLog.warn("Unknown outlet %s",tagtext);
            else if (isoutlet) addOutlet(form,tag);
            else if (!(tag)) {
                tag=mB.knodule.ref(tagtext);
                if (tag) addTag(form,tag);
                else addTag(form,tagtext);}
            else addTag(form,tag);}
        dropClass("METABOOKHUD",/gloss(tagging|addoutlet)/);}
    
    function getTagString(span,content){
        var tagval=span.getAttribute("data-tagval");
        if (tagval) {
            var at=tagval.indexOf('@');
            if ((mB.knodule)&&(at>0)&&
                (tagval.slice(at+1)===mB.knodule.name))
                return tagval.slice(0,at);
            else return tagval;}
        else {
            var bar=content.indexOf('|');
            if (bar>0) return content.slice(0,bar);
            else return content;}}

    var stdspace=fdjtString.stdspace;

    function handleTagInput(tagstring,form,exact){
        var isoutlet=(tagstring[0]==="@");
        var cloud=((isoutlet)?(mB.share_cloud):(mB.gloss_cloud));
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
                var ks=mB.gloss_cloud.getKey(completions.matches[0]);
                if ((exact)?(ks.toLowerCase()!==std.toLowerCase()):
                    (ks.toLowerCase().search()!==0)) {
                    // When exact is true, count on exact matches;
                    // even if it is false, don't except non-prefix
                    // matches
                    addTag(form,std);
                    mB.gloss_cloud.complete("");
                    return std;}}
            if (completion) {
                var span=addTag(form,completion);
                mB.gloss_cloud.complete("");
                return getTagString(span,mB.gloss_cloud.getKey(completion));}
            else {
                addTag(form,std);
                mB.gloss_cloud.complete("");
                return std;}}}
    metaBook.handleTagInput=handleTagInput;

    function get_addgloss_callback(form,keep,uri){
        return function(req){
            return addgloss_callback(req,form,keep,uri);};}

    function addgloss_callback(req,form,keep){
        if ((Trace.network)||(Trace.glossing))
            fdjtLog("Got AJAX gloss response %o from %o",req,req.uri);
        if (Trace.savegloss)
            fdjtLog("Gloss %o successfully added (status %d) to %o",
                    getInput(form,"UUID").value,req.status,
                    getInput(form,"FRAG").value);
        dropClass(form.parentNode,"submitting");
        if (keep)
            addClass(form.parentNode,"submitdone");
        else addClass(form.parentNode,"submitclose");
        var json=JSON.parse(req.responseText);
        var ref=mB.glossdb.Import(
            // item,rules,flags
            json,false,((RefDB.REFINDEX)|(RefDB.REFSTRINGS)|(RefDB.REFLOAD)));
        var reps=document.getElementsByName(ref._id);
        var i=0, lim=reps.length;
        while (i<lim) {
            var rep=reps[i++];
            if (hasClass(rep,"mbcard")) {
                var new_card=mB.renderCard(ref);
                if (new_card) fdjtDOM.replace(rep,new_card);}}
        ref.save();
        /* Turn off the target lock */
        if ((form)&&(!(keep))) {
            setTimeout(function(){
                if (hasClass(form.parentNode,"submitclose")) {
                    if ((form.parentNode)&&(form.parentNode))
                        fdjtDOM.remove(form.parentNode);
                    setGlossTarget(false);
                    mB.setTarget(false);
                    mB.setMode(false);}},
                       1500);}
        else if (form)
            setTimeout(function(){
                dropClass(form.parentNode,"submitdone");},
                       1500);
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

    function glosscloud_select(evt){
        var target=fdjtUI.T(evt);
        var completion=getParent(target,'.completion');
        if (completion) {
            var live=fdjtID("METABOOKLIVEGLOSS");
            var form=((live)&&(getChild(live,"form")));
            var span=addTag(form,completion);
            if (!(hasClass("METABOOKHUD","glossaddtag"))) {
                // This means we have a bracketed reference
                var tagstring=getTagString(
                    span,mB.gloss_cloud.getKey(completion));
                var input=getInput(form,"NOTE");
                if ((input)&&(tagstring)) tagclear(input);}}
        fdjtUI.cancel(evt);}
    mB.UI.handlers.glosscloud_select=glosscloud_select;

    /***** The Outlet Cloud *****/

    function sharecloud_ontap(evt){
        var target=fdjtUI.T(evt);
        var completion=getParent(target,'.completion');
        if (completion) {
            var live=fdjtID("METABOOKLIVEGLOSS");
            var form=((live)&&(getChild(live,"form")));
            var value=completion.getAttribute("data-value");
            if (hasClass(completion,"source")) {
                if (value) addOutlet(form,mB.sourcedb.ref(value),"SHARE");}
            else if (hasClass(completion,"network")) 
                addOutlet(form,completion,"NETWORK");
            else if (hasClass(completion,"email")) 
                if (value) addOutlet(form,completion,"EMAIL");
            else addOutlet(form,completion);}
        fdjtUI.cancel(evt);}
    metaBook.UI.sharecloud_ontap=sharecloud_ontap;

    /***** Saving (submitting/queueing) glosses *****/

    var login_message=false;

    // Submits a gloss, queueing it if offline.
    function submitGloss(arg,keep){
        var div=false, form=false;
        if (typeof arg === "undefined") {
            div=fdjtID("METABOOKLIVEGLOSS");
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
                    fdjt.ID("METABOOKDETAILTEXT").value;
                fdjt.ID("METABOOKDETAILTEXT").value="";}}
        addClass(div,"submitting");
        if (!((hasParent(form,".glossedit"))||
              (hasParent(form,".glossreply"))))
            // Only save defaults if adding a new gloss
            saveGlossDefaults(form,getChild("METABOOKADDGLOSSPROTOTYPE","FORM"));
        var uuidelt=getInput(form,"UUID");
        if (!((uuidelt)&&(uuidelt.value)&&(uuidelt.value.length>5))) {
            fdjtLog.warn('missing UUID');
            if (uuidelt) uuidelt.value=fdjtState.getUUID(mB.nodeid);}
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
            ((!(navigator.onLine))||(!(mB.connected)))) {
            var choices=[];
            if (navigator.onLine) 
                choices.push({label: "Login",
                              isdefault: true,
                              handler: function(){
                                  setTimeout(function(){mB.setMode("login");},0);
                                  var resubmit=function(){submitGloss(arg,keep);};
                                  if (mB._onconnect) mB._onconnect.push(resubmit);
                                  else mB._onconnect=[resubmit];
                                  login_message=true;}});
            if ((mB.user)&&(mB.persist)) 
                choices.push({label: "Queue",
                              isdefault: ((!(navigator.onLine))&&
                                          (mB.cacheglosses)),
                              handler: function(){
                                  if (mB.nocache)
                                      mB.setConfig("cacheglosses",true);
                                  login_message=true;
                                  if (!((navigator.onLine)&&(mB.connected)))
                                      queueGloss(arg,false,keep);
                                  else submitGloss(arg,keep);}});
            else {
                choices.push({label: "Cache",
                              isdefault: ((!(navigator.onLine))&&
                                          (mB.cacheglosses)),
                              handler: function(){
                                  if (mB.nocache)
                                      mB.setConfig("cacheglosses",true,true);
                                  login_message=true;
                                  queueGloss(arg,false,keep);}});
                if (mB.nocache)
                    choices.push({label: "Lose",
                                  isdefault:((!(navigator.onLine))&&
                                             (mB.nocache)),
                                  handler: function(){
                                      tempGloss(form); login_message=true;}});}
            choices.push({label: "Cancel",
                          handler: function(){
                              fdjtDOM.remove(form.parentNode);
                              setGlossTarget(false);
                              mB.setTarget(false);
                              mB.setMode(false);}});
            fdjtUI.choose(choices,
                          ((navigator.onLine)&&(!(mB.user))&&
                           ([fdjtDOM("p.smaller",
                                    "This book isn't currently associated with an sBooks account, ",
                                    "so any highlights or glosses you add will not be permanently saved ",
                                    "until you login."),
                             fdjtDOM("p.smaller",
                                     "You may either login now, cache your changes ",
                                     "on this machine until you do login, ",
                                     "lose your changes when this page closes, ",
                                     "or cancel the change you're about to make.")])),
                          (((navigator.onLine)&&(mB.user)&&
                            ([fdjtDOM("p.smaller",
                                     "You aren't currently logged into your sBooks account from ",
                                     "this machine, so any highlights or glosses you add won't ",
                                     "be saved until you do."),
                              fdjtDOM("p.smaller","In addition, you won't get updated glosses from ",
                                      "your networks or layers."),
                              fdjtDOM("p.smaller",
                                      "You may either login now, queue any changes you make until ",
                                     "you do login, or cancel the change you were trying to make.")]))),
                          ((!(navigator.onLine))&&(mB.nocache)&&
                           ([fdjtDOM("p.smaller",
                                    "You are currently offline and have elected to not save ",
                                    "highlights or glosses locally on this computer."),
                             fdjtDOM("p.smaller",
                                    "You can either queue your changes by storing information locally, ",
                                    "lose your changes when this page closes,",
                                    "or cancel the change you were about to make.")])));
            return;}
        var sent=((navigator.onLine)&&(mB.connected)&&(mB.user)&&
                  (fdjt.Ajax.onsubmit(form,get_addgloss_callback(form,keep))));
        if (!(sent)) queueGloss(form,((arg)&&(arg.type)&&(arg)),keep);
        else dropClass(div,"modified");}
    metaBook.submitGloss=submitGloss;

    function cancelGloss_handler(evt){
        evt=evt||window.event;
        var target=fdjtUI.T(evt);
        cancelGloss(target);
        fdjtUI.cancel(evt);}

    function cancelGloss(arg){
        var evt=arg||event||null;
        var target=((!arg)?(fdjtID("METABOOKLIVEGLOSS")):
                    (arg.nodeType)?(arg):(fdjtUI.T(arg)));
        var glossform=(target)&&
            (fdjtDOM.getParent(target,".codexglossform"));
        setGlossTarget(false);
        mB.setMode(false);
        if ((arg)&&((arg.cancelable)||(arg.bubbles))) {
            fdjtUI.cancel(evt);}
        if (glossform) fdjtDOM.remove(glossform);}
    metaBook.cancelGloss=cancelGloss;

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
        var queued=mB.queued;
        queued.push(json.uuid);
        if (mB.cacheglosses) {
            fdjtState.setLocal("metabook.params("+json.uuid+")",params);
            fdjtState.setLocal("metabook.queued("+mB.refuri+")",queued,true);}
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
        mB.glossdb.Import(glossdata,false,false,true);
        if (evt) fdjtUI.cancel(evt);
        dropClass(form.parentNode,"submitting");
        /* Turn off the target lock */
        if (!(keep)) {
            // Clear the UUID
            clearGlossForm(form);
            setGlossTarget(false);
            mB.setTarget(false);
            mB.setMode(false);}}

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
        mB.glossdb.Import(glossdata,false,false,true);
        // Clear the UUID
        clearGlossForm(form);
        if (evt) fdjtUI.cancel(evt);
        dropClass(form.parentNode,"submitting");
        /* Turn off the target lock */
        setGlossTarget(false); mB.setTarget(false); mB.setMode(false);}

    // Saves queued glosses
    function writeQueuedGlosses(){
        if (mB.queued.length) {
            var ajax_uri=getChild(fdjtID("METABOOKADDGLOSSPROTOTYPE"),"form").
                getAttribute("ajaxaction");
            var queued=mB.queued; var glossid=queued[0];
            var post_data=((mB.nocache)?((queued_data[glossid])):
                           (fdjtState.getLocal("metabook.params("+glossid+")")));
            if (post_data) {
                var req=new XMLHttpRequest();
                req.open('POST',ajax_uri);
                req.withCredentials='yes';
                req.onreadystatechange=function () {
                    if ((req.readyState === 4) &&
                        (req.status>=200) && (req.status<300)) {
                        fdjtState.dropLocal("metabook.params("+glossid+")");
                        var pending=mB.queued;
                        if ((pending)&&(pending.length)) {
                            var pos=pending.indexOf(glossid);
                            if (pos>=0) {
                                pending.splice(pos,pos);
                                if (mB.cacheglosses)
                                    fdjtState.setLocal("metabook.queued("+mB.refuri+")",pending,true);
                                mB.queued=pending;}}
                        addgloss_callback(req,false,false);
                        if (pending.length) setTimeout(writeQueuedGlosses,200);
                        fdjtState.dropLocal("metabook.queued("+mB.refuri+")");}
                    else if (req.readyState===4) {
                        mB.setConnected(false);}
                    else {}};
                try {
                    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    req.send(post_data);}
                catch (ex) {mB.setConnected(false);}}}}
    metaBook.writeQueuedGlosses=writeQueuedGlosses;
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
