/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/core.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.
   This file implements a Javascript/DHTML web application for reading
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
/* jshint browser: true */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
//var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
//var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
//var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));
//var fdjtMap=fdjt.Map;

var Codex={
    mode: false,hudup: false,scrolling: false,query: false,
    head: false,target: false,glosstarget: false,location: false,
    root: false,start: false,HUD: false,dosync: true,
    user: false, loggedin: false, cxthelp: false,
    _setup: false,_user_setup: false,_gloss_setup: false,_social_setup: false,
    // Whether we have a real connection to the server
    connected: false,
    // Keeping track of paginated context
    curpage: false,curoff: false,curinfo: false, curbottom: false,
    // For tracking UI state
    last_mode: false, last_heartmode: "about", demo: false,
    // How long it takes a gesture to go from tap to hold
    taptapmsecs: 500, holdmsecs: 200, edgeclick: 50, pagesize: 250,
    dontanimate: false,
    glossmodes: /(addtag)|(addoutlet)|(editdetail)|(hamburger)|(attach)/,
    // Various device properties which can effect behaviors
    fullheight: false, fullwidth: false, handheld: false,
    updatehash: true, iscroll: false,
    // This tracks missing node identifiers
    missing_nodes: [],
    // Whether to cache layouts locally; the value is a threshold
    // (in milliseconds) for when to cache
    cache_layout_thresh: 2500,
    // Ask about updating layouts which took longer than this
    //  many milliseconds to generate
    long_layout_thresh: 5000,
    // Whether to force new layouts
    forcelayout: false,
    // Whether layout is temporarily frozen, for example during text
    // input (on tablets, there may be extraneous resizes when the
    // on-screen keyboard appears)
    freezelayout: false,
    // Whether to locally store user information for offline availability
    keepuser: false,
    // Whether to locally save glosses, etc for offline availability,
    keepglosses: true,
    // Whether to store glosses, etc for offline access and improved
    // performance.  This is no longer used, replaced by the two values
    // above.
    keepdata: false,
    // Dominant interaction mode
    mouse: true, touch: false, kbd: false,
    // Whether there is a keyboard
    keyboard: true,
    // This is a table for iScroll scrollers, when used
    scrollers: {},
    // Restrictions on excerpts
    min_excerpt: 3, max_excerpt: false,
    // These are the UUIDs of locally stored glosses which are queued
    //  to be saved when possible (online and connected).
    queued: [],
    // These are weights assigned to search tags
    tagweights: false, tagmaxweight: 0, tagminweight: 200000000,
    // This is the base URI for this document, also known as the REFURI
    // A document (for instance an anthology or collection) may include
    // several refuri's, but this is the default.
    refuri: false,
    // These are the refuris used in this document
    refuris: [],
    // This is the document URI, which is usually the same as the REFURI.
    docuri: false,
    // This is the unique signed DOC+USER identifier used by myCopy
    // social DRM
    mycopyid: false, 
    // This is the time of the last update
    syncstamp: false,
    // Number of milliseconds between gloss updates
    update_interval: 5*60*1000,
    // Number of milliseconds between location sync
    sync_interval: 5*1000,
    // Various handlers, settings, and status information for the
    // Codex interface
    UI: {
        // This maps device types into sets of node->event handlers
        handlers: {mouse: {}, touch: {}, kbd: {}, ios: {}}},
    Debug: {},
    /* This is where HTML source strings for UI components are placed */
    HTML: {},
    /* This is where we store pointers into the DOM, CSS, and TapHold objects */
    DOM: {}, CSS: {}, TapHold: {},
    /* XTARGETS are procedures linked to fragment ids */
    xtargets: {},
    // Where various event timestamps are stored
    Timeline: {},
    // What to trace, for debugging
    Trace: {
        startup: 1,       // Whether to trace startup
        config: 0,        // Whether to trace config setup/modification/etc
        mode: false,      // Whether to trace mode changes
        nav: false,       // Whether to trace book navigation
        scan: 0,          // How much to trace DOM scanning
        search: 0,        // How much to trace searches
        clouds: 0,        // How much to trace cloud generation
        target: false,    // Whether to trace target changes
        toc: false,       // Whether we're debugging TOC tracking
        storage: 0,       // How much to trace offline persistence
        network: 0,       // How much to trace server interaction
        state: false,     // Whether to trace synchronization
        savegloss: 0,     // When glosses are saved to the server
        glosses: 0,       // How much we're tracing gloss processing
        addgloss: 0,      // Note whenever a gloss post completes
        layout: 0,        // How much to trace document layout
        knodules: 0,      // How much to trace knodule processing
        flips: false,     // Whether to trace page flips (movement by pages)
        messages: false,  // Whether to trace inter-window messages
        selection: false, // Whether to trace inter-window messages
        iscroll: false,   // Whether to trace HUD scrolling with iScroll
        highlight: 0,     // Whether to trace highlighting
        indexing: 0,      // How much to trace document indexing
        gestures: 0}      // How much to trace gestures
};

(function(){
    "use strict";

    var fdjtString=fdjt.String;
    var fdjtState=fdjt.State;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var fdjtID=fdjt.ID;
    var RefDB=fdjt.RefDB, Ref=fdjt.Ref;
    var ObjectMap=fdjt.Map||RefDB.Map;

    var hasClass=fdjtDOM.hasClass;
    var addClass=fdjtDOM.addClass;
    var dropClass=fdjtDOM.dropClass;
    var hasParent=fdjtDOM.hasParent;

    var getLocal=fdjtState.getLocal;
    var setLocal=fdjtState.setLocal;
    
    Codex.tagweights=new ObjectMap();

    function hasLocal(key){
        if (Codex.keepuser) return fdjtState.existsLocal(key);
        else return fdjtState.existsSession(key);}
    Codex.hasLocal=hasLocal;
    function saveLocal(key,value,unparse){
        if (Codex.keepuser) setLocal(key,value,unparse);
        else fdjtState.setSession(key,value,unparse);}
    Codex.saveLocal=saveLocal;
    function readLocal(key,parse){
        if (Codex.keepuser) return getLocal(key,parse)||
            fdjtState.getSession(key,parse);
        else return fdjtState.getSession(key,parse)||getLocal(key,parse);}
    Codex.readLocal=readLocal;
    function clearLocal(key){
        fdjtState.dropLocal(key);
        fdjtState.dropSession(key);}
    Codex.clearLocal=clearLocal;

    
    function initDB() {
        if (Codex.Trace.start>1) fdjtLog("Initializing DB");
        var refuri=(Codex.refuri||document.location.href);
        if (refuri.indexOf('#')>0) refuri=refuri.slice(0,refuri.indexOf('#'));

        var docdb=Codex.docdb=new RefDB(
            refuri+"#",{indices: ["frag","head","heads",
                                  "tags","tags*",
                                  "*tags","**tags","~tags",
                                  "*tags","**tags","~tags",
                                  "*tags*","**tags*","~tags*",
                                  "^tags","~^tags","*^tags","**^tags",
                                  "^tags*","~^tags*","*^tags*","**^tags*"]});
        
        var knodule_name=
            fdjtDOM.getMeta("SBOOKS.knodule")||
            fdjtDOM.getMeta("~KNODULE")||
            refuri;
        Codex.knodule=new Knodule(knodule_name);
        Knodule.current=Codex.knodule;
        Codex.BRICO=new Knodule("BRICO");
        Codex.BRICO.addAlias(":@1/");
        Codex.BRICO.addAlias("@1/");
        var glosses_init={
            indices: ["frag","maker","outlets",
                      "tags","*tags","**tags",
                      "tags*","*tags*","**tags*"]};
        var stdspace=fdjtString.stdspace;
        var glossdb=Codex.glossdb=new RefDB("glosses@"+Codex.refuri,glosses_init); {
            Codex.glossdb.absrefs=true;
            Codex.glossdb.addAlias("glossdb");
            Codex.glossdb.addAlias("-UUIDTYPE=61");
            Codex.glossdb.addAlias(":@31055/");
            Codex.glossdb.addAlias("@31055/");
            Codex.glossdb.onLoad(function initGloss(item) {
                var info=Codex.docinfo[item.frag];
                if (!(info)) {
                    fdjtLog("Gloss refers to nonexistent '%s': %o",
                            item.frag,item);
                    return;}
                if ((info)&&(info.starts_at)) {
                    item.starts_at=info.starts_at+(item.exoff||0);}
                if ((info)&&(info.ends_at)) {
                    if (item.excerpt)
                        item.ends_at=info.ends_at+(item.exoff||0)+
                        (stdspace(item.excerpt).length);
                    else item.ends_at=info.ends_at;}
                if ((!(item.maker))&&(Codex.user)) item.maker=(Codex.user);
                var maker=(item.maker)&&(Codex.sourcedb.ref(item.maker));
                if (maker) {
                    Codex.addTag2Cloud(maker,Codex.empty_cloud);
                    Codex.UI.addGlossSource(maker,true);}
                var maker_knodule=Codex.getMakerKnodule(item.maker);
                var make_cue=(maker===Codex.user);
                var i, lim, sources=item.sources;
                if (sources) {
                    if (typeof sources === 'string') sources=[sources];
                    if ((sources)&&(sources.length)) {
                        i=0; lim=sources.length; while (i<lim) {
                            var source=sources[i++];
                            var ref=Codex.sourcedb.ref(source);
                            Codex.UI.addGlossSource(ref,true);}}}
                var alltags=item.alltags;
                if ((alltags)&&(alltags.length)) {
                    i=0; lim=alltags.length; while (i<lim) {
                        var each_tag=alltags[i++], entry;
                        entry=Codex.addTag2Cloud(each_tag,Codex.empty_cloud);
                        if ((make_cue)&&(entry)) addClass(entry,"cue");
                        entry=Codex.addTag2Cloud(each_tag,Codex.gloss_cloud);
                        if ((make_cue)&&(entry)) addClass(entry,"cue");}
                    var tag_slots=["tags","*tags","**tags"];
                    var s=0, n_slots=tag_slots.length; while (s<n_slots) {
                        var tagslot=tag_slots[s++], tags=item[tagslot];
                        if ((tags)&&(tags.length)) {
                            var fragslot="+"+tagslot;
                            if (item.thread) {
                                Codex.addTags(item.thread,tags,fragslot);
                                if (item.replyto!==item.thread)
                                    Codex.addTags(item.replyto,tags,fragslot);}
                            if (info) Codex.addTags(info,tags,fragslot,maker_knodule);}}}},
                                 "initgloss");
            if ((Codex.user)&&(Codex.keepuser)&&(Codex.keepglosses)&&
                (!(Codex.force_online)))
                Codex.glossdb.storage=window.localStorage;}
        
        function Gloss(){return Ref.apply(this,arguments);}
        Gloss.prototype=new Ref();
        
        var exportTagSlot=Knodule.exportTagSlot;
        var tag_export_rules={
            "*tags": exportTagSlot, "**tags": exportTagSlot,
            "~tags": exportTagSlot, "~~tags": exportTagSlot,
            "tags": exportTagSlot,
            "*tags*": exportTagSlot, "**tags*": exportTagSlot,
            "~tags*": exportTagSlot, "~~tags*": exportTagSlot,
            "tags*": exportTagSlot,
            "*tags**": exportTagSlot, "**tags**": exportTagSlot,
            "~tags**": exportTagSlot, "~~tags**": exportTagSlot,
            "tags**": exportTagSlot};
        Codex.tag_export_rules=tag_export_rules;
        Codex.tag_import_rules=tag_export_rules;

        // Use this when generating external summaries.  In particular,
        //  this recovers all of the separate weighted tag slots into
        //  one tags slot which uses prefixed strings to indicate weights.
        Gloss.prototype.ExportExternal=function exportGloss(){
            return Ref.Export.call(this,tag_export_rules);};

        Codex.glossdb.refclass=Gloss;
        
        Codex.sourcedb=new RefDB("sources@"+Codex.refuri);{
            Codex.sourcedb.absrefs=true;
            Codex.sourcedb.addAlias("@1961/");
            Codex.sourcedb.addAlias(":@1961/");            
            Codex.sourcedb.forDOM=function(source){
                var spec="span.source"+((source.kind)?".":"")+
                    ((source.kind)?(source.kind.slice(1).toLowerCase()):"");
                var name=source.name||source.oid||source.uuid||source.uuid;
                var span=fdjtDOM(spec,name);
                if (source.about) span.title=source.about;
                return span;};
            var anonymous=Codex.sourcedb.ref("@1961/0");
            Codex.anonymous=anonymous;
            anonymous.name="anonymous";}

        Codex.queued=((Codex.keepglosses)&&
                      (getLocal("queued("+Codex.refuri+")",true)))||
            [];

        function Query(tags,base_query){
            if (!(this instanceof Query))
                return new Query(tags,base_query);
            else if (arguments.length===0) return this;
            else {
                var query=Knodule.TagQuery.call(this,tags);
                if (Codex.Trace.search) query.log={};
                return query;}}
        Query.prototype=new Knodule.TagQuery();
        Query.prototype.dbs=[Codex.glossdb,Codex.docdb];
        Query.prototype.weights={"tags": 4,"^tags": 2,"+tags": 8,"^+tags": 4};
        Query.prototype.uniqueids=true;
        Codex.Query=Query;

        Codex.query=Codex.empty_query=new Query([]);

        if (Codex.Trace.start>1) fdjtLog("Initialized DB");}
    Codex.initDB=initDB;

    function getMakerKnodule(arg){
        var result;
        if (!(arg)) arg=Codex.user;
        if (!(arg)) return (Codex.knodule);
        else if (typeof arg === "string")
            return getMakerKnodule(Codex.sourcedb.probe(arg));
        else if ((arg.maker)&&(arg.maker instanceof Ref))
            result=new Knodule(arg.maker.getQID());
        else if ((arg.maker)&&(typeof arg.maker === "string"))
            return getMakerKnodule(Codex.sourcedb.probe(arg.maker));
        else if (arg._qid)
            result=new Knodule(arg._qid);
        else if (arg._id)
            result=new Knodule(arg._i);
        else result=Codex.knodule;
        result.description=arg.name;
        return result;}
    Codex.getMakerKnodule=getMakerKnodule;

    var trace1="%s %o in %o: mode%s=%o, target=%o, head=%o scanning=%o";
    var trace2="%s %o: mode%s=%o, target=%o, head=%o scanning=%o";
    function sbook_trace(handler,cxt){
        var target=((cxt.nodeType)?(cxt):(fdjtUI.T(cxt)));
        if (target)
            fdjtLog(trace1,handler,cxt,target,
                    ((Codex.scanning)?("(scanning)"):""),Codex.mode,
                    Codex.target,Codex.head,Codex.scanning);
        else fdjtLog(trace2,handler,cxt,
                     ((Codex.scanning)?("(scanning)"):""),Codex.mode,
                     Codex.target,Codex.head,Codex.scanning);}
    Codex.trace=sbook_trace;

    // This is the hostname for the sbookserver.
    Codex.server=false;
    // This is an array for looking up sbook servers.
    Codex.servers=[[/.sbooks.net$/g,"glosses.sbooks.net"]];
    //Codex.servers=[];
    // This is the default server
    Codex.default_server="glosses.sbooks.net";
    // There be icons here!
    Codex.root=fdjtDOM.getLink("CODEX.staticroot")||
        "http://static.beingmeta.com/";
    if (Codex.root[Codex.root.length-1]!=="/")
        Codex.root=Codex.root+"/";
    Codex.withsvg=document.implementation.hasFeature(
        "http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1")||
        navigator.mimeTypes["image/svg+xml"];
    Codex.svg=fdjt.DOM.checkSVG();
    if (fdjtState.getQuery("nosvg")) Codex.svg=false;
    else if (fdjtState.getQuery("withsvg")) Codex.svg=true;
    Codex.icon=function(base,width,height){
        return Codex.root+"g/codex/"+base+
            ((Codex.svg)?(".svgz"):
             ((((width)&&(height))?(width+"x"+height):
               (width)?(width+"w"):(height)?(height+"h"):"")+
              ".png"));};

    function getRefURI(target){
        var scan=target;
        while ((scan)&&(scan!==document)) {
            if (scan.getAttribute("data-refuri"))
                return scan.getAttribute("data-refuri");
            else if ((scan.getAttributeNS)&&
                     (scan.getAttributeNS("refuri","http://sbooks.net/")))
                return scan.getAttributeNS("refuri","http://sbooks.net/");
            else if (scan.getAttribute("refuri"))
                return scan.getAttribute("refuri");
            else scan=scan.parentNode;}
        return Codex.refuri;}
    Codex.getRefURI=getRefURI;

    function getDocURI(target){
        var scan=target;
        while ((scan)&&(scan!==document)) {
            if (scan.getAttribute("data-docuri"))
                return scan.getAttribute("data-docuri");
            else if ((scan.getAttributeNS)&&
                     (scan.getAttributeNS("docuri","http://sbooks.net/")))
                return scan.getAttributeNS("docuri","http://sbooks.net/");
            else if (scan.getAttribute("docuri"))
                return scan.getAttribute("docuri");
            else scan=scan.parentNode;}
        return Codex.docuri;}
    Codex.getDocURI=getDocURI;

    Codex.getRefID=function(target){
        if (target.getAttributeNS)
            return (target.getAttributeNS('sbookid','http://sbooks.net/'))||
            (target.getAttributeNS('sbookid'))||
            (target.getAttributeNS('data-sbookid'))||
            (target.codexbaseid)||(target.id);
        else return target.id;};

    function getHead(target){
        /* First, find some relevant docinfo */
        var targetid=(target.codexbaseid)||(target.id);
        if ((targetid)&&(Codex.docinfo[targetid]))
            target=Codex.docinfo[targetid];
        else if (targetid) {
            while (target)
                if ((target.id)&&(Codex.docinfo[targetid])) {
                    target=Codex.docinfo[targetid]; break;}
            else target=target.parentNode;}
        else {
            /* First, try scanning forward to find a non-empty node */
            var scan=target.firstChild; var scanid=false;
            var next=target.nextNode;
            while ((scan)&&(scan!==next)) {
                if ((scan.id)||(scan.codexbaseid)) break;
                if ((scan.nodeType===3)&&
                    (!(fdjtString.isEmpty(scan.nodeValue)))) break;
                scan=fdjtDOM.forward(scan);}
            /* If you found something, use it */
            if ((scan)&&(scan.id)&&(scan!==next))
                target=Codex.docinfo[scanid];
            else {
                while (target)
                    if ((targetid=((target.codexbaseid)||(target.id)))&&
                        (Codex.docinfo[targetid])) {
                        target=Codex.docinfo[targetid]; break;}
                else target=target.parentNode;}}
        if (target) {
            if (target.level)
                return cxID(target.frag);
            else if (target.head)
                return cxID(target.head.frag);
            else return false;}
        else return false;}
    Codex.getHead=getHead;

    Codex.getRef=function(target){
        while (target)
            if (target.about) break;
        else if ((target.getAttribute)&&(target.getAttribute("about"))) break;
        else target=target.parentNode;
        if (target) {
            var ref=((target.about)||(target.getAttribute("about")));
            if (!(target.about)) target.about=ref;
            if (ref[0]==='#')
                return cxID(ref.slice(1));
            else return cxID(ref);}
        else return false;};
    Codex.getRefElt=function(target){
        while (target)
            if ((target.about)||
                ((target.getAttribute)&&(target.getAttribute("about"))))
                break;
        else target=target.parentNode;
        return target||false;};

    Codex.checkTarget=function(){
        if ((Codex.target)&&(Codex.mode==='openglossmark'))
            if (!(fdjtDOM.isVisible(Codex.target))) {
                Codex.setMode(false); Codex.setMode(true);}};

    function getDups(id){
        if (!(id)) return false;
        else if (typeof id === "string") {
            if ((Codex.layout)&&(Codex.layout.dups)) {
                var dups=Codex.layout.dups;
                var d=dups[id];
                if (d) return [cxID(id)].concat(d);
                else return [cxID(id)];}
            else return [cxID(id)];}
        else return getDups(id.codexbaseid||id.id);}
    Codex.getDups=getDups;

    function getTarget(scan,closest){
        scan=((scan.nodeType)?(scan):(scan.target||scan.srcElement||scan));
        var target=false, id=false, targetids=Codex.targetids;
        if (hasParent(scan,Codex.HUD)) return false;
        else if (hasParent(scan,".codexmargin")) return false;
        else while (scan) {
            if (scan.codexui) return false;
            else if ((scan===Codex.docroot)||(scan===document.body))
                return target;
            else if ((id=(scan.codexbaseid||scan.id))&&(Codex.docinfo[id])) {
                if ((!(scan.codexbaseid))&&(id.search("CODEXTMP")===0)) {}
                else if ((targetids)&&(id.search(targetids)!==0)) {}
                else if (hasClass(scan,"sbooknofocus")) {}
                else if ((Codex.nofocus)&&(Codex.nofocus.match(scan))) {}
                else if (hasClass(scan,"sbookfocus")) return scan;
                else if ((Codex.focus)&&(Codex.focus.match(scan))) return scan;
                else if (closest) return scan;
                else if ((target)&&
                         ((scan.tagName==='section')||
                          ((scan.className)&&
                           (scan.className.search(/\bhtml5section\b/i)>=0))))
                    return target;
                else if ((target)&&(!(fdjt.DOM.isVisible(scan))))
                    return target;
                else target=scan;}
            else {}
            scan=scan.parentNode;}
        return target;}
    Codex.getTarget=getTarget;
    
    var isEmpty=fdjtString.isEmpty;

    function notEmpty(arg){
        if (typeof arg === 'string') {
            if (isEmpty(arg)) return false;
            else return arg;}
        else return false;}

    var codex_docinfo=false;
    function cxID(id){
        var info;
        if (!(codex_docinfo)) codex_docinfo=Codex.docinfo;
        return ((codex_docinfo)&&(info=codex_docinfo[id])&&(info.elt.id)&&(info.elt))||
            document.getElementById(id)||
            fdjtDOM.$1("[data-tocid='"+id+"']");}
    Codex.ID=cxID;

    Codex.getTitle=function(target,tryhard) {
        var targetid;
        return target.sbooktitle||
            (((targetid=((target.codexbaseid)||(target.id)))&&
              (Codex.docinfo[targetid]))?
             (notEmpty(Codex.docinfo[targetid].title)):
             (notEmpty(target.title)))||
            ((tryhard)&&
             (fdjtDOM.textify(target)).
             replace(/\n(\s*\n)+/g,"\n").
             replace(/^\n+/,"").
             replace(/\n+$/,"").
             replace(/\n+/g," // ").
             replace(/^\s*\/\//,""));};

    function getinfo(arg){
        if (arg) {
            if (typeof arg === 'string')
                return (Codex.docinfo[arg]||
                        Codex.glossdb.probe(arg)||
                        RefDB.resolve(arg));
            else if (arg._id) return arg;
            else if (arg.codexbaseid)
                return Codex.docinfo[arg.codexbaseid];
            else if (arg.id) return Codex.docinfo[arg.id];
            else return false;}
        else return false;}
    Codex.Info=getinfo;

    /* Getting tagstrings from a gloss */
    var tag_prefixes=["","*","**","~","~~"];
    function getGlossTags(gloss){
        var results=[];
        var i=0, lim=tag_prefixes.length; while (i<lim) {
            var prefix=tag_prefixes[i++];
            var tags=gloss[prefix+"tags"];
            if (!(tags)) continue;
            else if (!(tags instanceof Array)) tags=[tags];
            var j=0, ntags=tags.length;
            while (j<ntags) {
                var tag=tags[j++];
                if (prefix==="") results.push(tag);
                else results.push({prefix: prefix,tag: tag});}}
        return results;}
    Codex.getGlossTags=getGlossTags;

    /* Navigation functions */

    function setHead(head){
        if (!(head)) {
            if (Codex.mode==="tocscan") Codex.setMode(false);
            return;}
        else if (typeof head === "string") 
            head=getHead(cxID(head))||Codex.content;
        else {}
        var headid=head.codexbaseid||head.id;
        var headinfo=Codex.docinfo[headid];
        while ((headinfo)&&(!(headinfo.level))) {
            headinfo=headinfo.head;
            headid=headinfo.frag;
            head=cxID(headid);}
        if (Codex.Trace.nav)
            fdjtLog("Codex.setHead #%s",headid);
        if (head===Codex.head) {
            if (Codex.Trace.target) fdjtLog("Redundant SetHead");
            return;}
        else if (headinfo) {
            if (Codex.Trace.target)
                Codex.trace("Codex.setHead",head);
            Codex.TOC.setHead(headinfo);
            window.title=headinfo.title+" ("+document.title+")";
            if (Codex.head) dropClass(Codex.head,"sbookhead");
            addClass(head,"sbookhead");
            Codex.setLocation(Codex.location);
            Codex.head=cxID(headid);
            Codex.TOC.setHead(headinfo);}
        else {
            if (Codex.Trace.target)
                Codex.trace("Codex.setFalseHead",head);
            Codex.TOC.setHead(headinfo);
            Codex.head=false;}}
    Codex.setHead=setHead;

    function setLocation(location,force){
        if ((!(force)) && (Codex.location===location)) return;
        if (Codex.Trace.toc)
            fdjtLog("Setting location to %o",location);
        var info=Codex.Info(Codex.head);
        while (info) {
            var tocelt=document.getElementById("CODEXTOC4"+info.frag);
            var statictocelt=document.getElementById("CODEXSTATICTOC4"+info.frag);
            var hinfo=info.head, hhlen=((hinfo)&&(hinfo.ends_at-hinfo.starts_at));
            var start=info.starts_at; var end=info.ends_at;
            var progress=((location-start)*100)/hhlen;
            var bar=false, appbar=false;
            if (tocelt) {
                // tocelt.title=Math.round(progress)+"%";
                bar=fdjtDOM.getFirstChild(tocelt,".progressbar");}
            if (statictocelt) {
                appbar=fdjtDOM.getFirstChild(statictocelt,".progressbar");}
            if (Codex.Trace.toc)
                fdjtLog("For tocbar %o/%o loc=%o start=%o end=%o progress=%o",
                        bar,appbar,location,start,end,progress);
            if ((progress>=0) && (progress<=100)) {
                if (bar) bar.style.width=(progress)+"%";
                if (appbar) appbar.style.width=(progress)+"%";}
            info=info.head;}
        var spanbars=fdjtDOM.$(".spanbar");
        var i=0; while (i<spanbars.length) {
            var spanbar=spanbars[i++];
            var width=spanbar.ends-spanbar.starts;
            var ratio=(location-spanbar.starts)/width;
            if (Codex.Trace.toc)
                fdjtLog("ratio for spanbar %o[%d] is %o [%o,%o,%o]",
                        spanbar,spanbar.childNodes[0].childNodes.length,
                        ratio,spanbar.starts,location,spanbar.ends);
            if ((ratio>=0) && (ratio<=1)) {
                var progressbox=fdjtDOM.$(".progressbox",spanbar);
                if (progressbox.length>0) {
                    progressbox=progressbox[0];
                    progressbox.style.left=((Math.round(ratio*10000))/100)+"%";}}}
        Codex.location=location;}
    Codex.setLocation=setLocation;

    function location2pct(location) {
        var max_loc=Codex.ends_at;
        var pct=(100*location)/max_loc;
        if (pct>100) pct=100;
        // This is (very roughly) intended to be the precision needed
        //  for line level (40 character) accuracy.
        var prec=Math.round(Math.log(max_loc/40)/Math.log(10))-2;
        if (prec<0) prec=0;
        if (Math.floor(pct)===pct)
            return Math.floor(pct)+"%";
        else return fdjtString.precString(pct,prec)+"%";}
    Codex.location2pct=location2pct;

    function setTarget(target){
        if (Codex.Trace.target) Codex.trace("Codex.setTarget",target);
        if (target===Codex.target) return;
        else if ((Codex.target)&&
                 (Codex.target.id===target.codexbaseid))
            return;
        if (Codex.target) {
            var old_target=Codex.target, oldid=old_target.id;
            var old_targets=getDups(oldid);
            dropClass(old_target,"codextarget");
            dropClass(old_target,"codexnewtarget");
            dropClass(old_targets,"codextarget");
            dropClass(old_targets,"codexnewtarget");
            if (!(hasParent(old_target,target)))
                clearHighlights(old_targets);
            Codex.target=false;}
        if (!(target)) {
            if (Codex.UI.setTarget) Codex.UI.setTarget(false);
            return;}
        else if ((inUI(target))||(!(target.id||target.codexbaseid)))
            return;
        else {}
        var targetid=target.codexbaseid||target.id;
        var primary=((targetid)&&(cxID(targetid)))||target;
        var targets=getDups(targetid);
        addClass(target,"codextarget");
        addClass(target,"codexnewtarget");
        addClass(targets,"codextarget");
        addClass(targets,"codexnewtarget");
        setTimeout(function(){
            dropClass(target,"codexnewtarget");
            dropClass(targets,"codexnewtarget");},
                   3000);
        fdjtState.setCookie(
            "codextarget",targetid||target.getAttribute('data-sbookid'));
        Codex.target=primary;
        if (Codex.UI.setTarget) Codex.UI.setTarget(primary);
        if (Codex.empty_cloud)
            Codex.setCloudCuesFromTarget(Codex.empty_cloud,primary);}
    Codex.setTarget=setTarget;

    function clearHighlights(target){
        if (typeof target === "string") target=cxID(target);
        if (!(target)) return;
        else if (target.length) {
            dropClass(target,"codexhighlightpassage");
            var i=0, lim=target.length;
            while (i<lim) {
                var node=target[i++];
                fdjtUI.Highlight.clear(node,"codexhighlightexcerpt");
                fdjtUI.Highlight.clear(node,"codexhighlightsearch");}}
        else {
            dropClass(target,"codexhighlightpassage");
            fdjtUI.Highlight.clear(target,"codexhighlightexcerpt");
            fdjtUI.Highlight.clear(target,"codexhighlightsearch");}}
    Codex.clearHighlights=clearHighlights;

    function findExcerpt(node,excerpt,off){
        if (typeof node === "string") node=cxID(node);
        if (!(node)) return false;
        if (node.nodeType) node=getDups(node);
        var found=fdjtDOM.findString(node,excerpt,off||0);
        if (found) return found;
        var trimmed=fdjtString.trim(excerpt);
        var regex_string=fdjtDOM.textRegExp(trimmed);
        var pattern=new RegExp("(\\s*)"+regex_string+"(\\s*)","gm");
        var matches=fdjtDOM.findMatches(node,pattern,off||0,1);
        if ((matches)&&(matches.length)) return matches[0];
        // We could do this more intelligently
        var result=false;
        matches=fdjtDOM.findMatches(node,pattern,0,1);
        while (matches.length>0) {
            result=matches[0];
            matches=fdjtDOM.findMatches(
                node,pattern,result.end_offset+1,1);}
        if ((matches)&&(matches.length)) return matches[0];
        else return result;}
    Codex.findExcerpt=findExcerpt;

    /* Tags */

    function parseTag(tag,kno){
        var slot="tags"; var usekno=kno||Codex.knodule;
        if (tag[0]==="~") {
            slot="~tags"; tag=tag.slice(1);}
        else if ((tag[0]==="*")&&(tag[1]==="*")) {
            slot="**tags"; tag=tag.slice(2);}
        else if (tag[0]==="*") {
            slot="*tags"; tag=tag.slice(1);}
        else {}
        var knode=((tag.indexOf('|')>=0)?
                   (usekno.handleSubjectEntry(tag)):
                   (slot==="~tags")?
                   (((kno)&&(kno.probe(tag)))||(tag)):
                   (usekno.handleSubjectEntry(tag)));
        if (slot!=="tags") return {slot: slot,tag: knode};
        else return knode;}
    Codex.parseTag=parseTag;
    
    var knoduleAddTags=Knodule.addTags;
    function addTags(nodes,tags,slotid,tagdb){
        if (!(slotid)) slotid="tags";
        if (!(tagdb)) tagdb=Codex.knodule;
        var docdb=Codex.docdb;
        if (!(nodes instanceof Array)) nodes=[nodes];
        knoduleAddTags(nodes,tags,docdb,tagdb,slotid);
        var i=0, lim=nodes.length; while (i<lim) {
            var node=nodes[i++];
            if (!(node.toclevel)) continue;
            var passages=docdb.find('head',node);
            if ((passages)&&(passages.length))
                knoduleAddTags(passages,tags,docdb,tagdb,"^"+slotid);
            var subheads=docdb.find('heads',node);
            if ((subheads)&&(subheads.length))
                addTags(subheads,tags,slotid,tagdb);}}
    Codex.addTags=addTags;
        
    /* Navigation */

    var sbookUIclasses=
        /(\bhud\b)|(\bglossmark\b)|(\bleading\b)|(\bcodexmargin\b)/;

    function inUI(elt){
        if (elt.codexui) return true;
        else if (hasParent(elt,Codex.HUD)) return true;
        else while (elt)
            if (elt.codexui) return true;
        else if (hasClass(elt,sbookUIclasses)) return true;
        else elt=elt.parentNode;
        return false;}
    Codex.inUI=inUI;

    function setHashID(target){
        var targetid=target.codexbaseid||target.id;
        if ((!(targetid))||(window.location.hash===targetid)||
            ((window.location.hash[0]==='#')&&
             (window.location.hash.slice(1)===targetid)))
            return;
        if ((target===Codex.body)||(target===document.body)) return;
        if (targetid) window.location.hash=targetid;}
    Codex.setHashID=setHashID;

    // Assert whether we're connected and update body classes
    //  to reflect the state. Also, run run any delayed thunks
    //  queued for connection.
    function setConnected(val){
        if ((val)&&(!(Codex.connected))) {
            var onconnect=Codex._onconnect;
            Codex._onconnect=false;
            if ((onconnect)&&(onconnect.length)) {
                var i=0; var lim=onconnect.length;
                while (i<lim) (onconnect[i++])();}
            if (fdjtState.getLocal("queued("+Codex.refuri+")"))
                Codex.writeQueuedGlosses();}
        if (((val)&&(!(Codex.connected)))||
            ((!(val))&&(Codex.connected)))
            fdjtDOM.swapClass(document.body,/\bcx(CONN|DISCONN)\b/,
                              ((val)?("cxCONN"):("cxDISCONN")));
        Codex.connected=val;
    } Codex.setConnected=setConnected;


    /* Managing the reader state */

    var syncing=false;
    
    Codex.initState=function initState() {
        var uri=Codex.docuri;
        var state=readLocal("codex.state("+uri+")",true);
        var hash=window.location.hash;
        if (hash) {
            if (hash[0]==="#") hash=hash.slice(1);}
        else hash=false;
        var elt=((hash)&&(cxID(hash)));
        if (elt) {
            if (!((state)&&(state.target===hash))) {
                if (!(state)) state={};
                // Hash changed
                state.refuri=Codex.refuri;
                state.docuri=Codex.docuri;
                state.target=hash;
                state.location=false;
                state.changed=fdjtTime.tick;}}
        if (state) Codex.state=state;};
    
    // This records the current state of the app, bundled into an
    //  object and primarily consisting a location, a target, and
    //  the time it was last changed.
    // Mechanically, this fills things out and stores the object
    //  in Codex.state as well as in local storage.  If the changed
    //  date is later than the current.xstate, it also does
    //  an Ajax call to update the server.
    // Finally, unless skiphist is true, it updates the browser
    //  history.
    function saveState(state,skiphist,force){
        if ((!force)&&(state)&&
            ((Codex.state===state)||
             ((Codex.state)&&
              (Codex.state.target===state.target)&&
              (Codex.state.location===state.location)&&
              (Codex.state.page===state.page))))
            return;
        if (!(state)) state=Codex.state;
        if (!(state.changed)) state.changed=fdjtTime.tick();
        if (!(state.refuri)) state.refuri=Codex.refuri;
        var title=state.title, frag=state.target;
        if ((!(title))&&(frag)&&(Codex.docinfo[frag])) {
            state.title=title=Codex.docinfo[frag].title||
                Codex.docinfo[frag].head.title;}
        if (Codex.Trace.state) fdjtLog("Setting state to %j",state);
        if ((state.maxloc)&&(state.maxloc<state.location))
            state.maxloc=state.location;
        else if (!(state.maxloc)) state.maxloc=state.location;
        if (Codex.Trace.state)
            fdjtLog("saveState skiphist=? force=? state=%j",
                    skiphist,force,state);
        Codex.state=state;
        var statestring=JSON.stringify(state);
        var uri=Codex.docuri;
        saveLocal("codex.state("+uri+")",statestring);
        if ((!(syncing))&&(Codex.dosync)&&
            ((!(Codex.xstate))||(state.changed>Codex.xstate.changed)))
            syncState(true);
        if ((!(skiphist))&&(frag)&&(window.history)&&(window.history.pushState))
            setHistory(state,frag,title);
    } Codex.saveState=saveState;

    // This sets the browser history from a particular state
    function setHistory(state,hash,title){
        if (Codex.Trace.state) {
            if (title)
                fdjtLog("setHistory %s (%s) state=%j",hash,title,state);
            else fdjtLog("setHistory %s state=%j",hash,state);}
        if (!((window.history)&&(window.history.pushState))) return;
        if (!(hash)) hash=state.target;
        if (!(title)) title=state.title;
        var href=fdjtState.getURL();
        if ((!(title))&&(hash)&&(Codex.docinfo[hash])) {
            state.title=title=Codex.docinfo[hash].title||
                Codex.docinfo[hash].head.title;}
        if ((!(hash))&&(state.location)&&
            (typeof state.location === "number"))
            hash="SBOOKLOC"+state.location;
        if (Codex.Trace.state)
            fdjtLog("Pushing history %j %s (%s) '%s'",
                    state,href,title);
        window.history.pushState(state,title,href+"#"+hash);
    }

    function restoreState(state,reason,savehist){
        if (Codex.Trace.state) fdjtLog("Restoring (%s) state %j",reason,state);
        if (state.location)
            Codex.GoTo(state.location,reason||"restoreState",
                       ((state.target)&&(cxID(state.target))),
                       // Don't save the state since we've already got one
                       false,(!(savehist)));
        else if ((state.page)&&(Codex.layout)) {
            Codex.GoToPage(state.page,reason||"restoreState",
                           // Don't save the state since we've already got one
                           false,(!(savehist)));
            if ((state.target)&&(cxID(state.target)))
                setTarget(cxID(state.target));}
        if (!(state.refuri)) state.refuri=Codex.refuri;
        if (!(state.docuri)) state.docuri=Codex.docuri;
        saveState(state);
    } Codex.restoreState=restoreState;

    function clearState(){
        var uri=Codex.docuri;
        Codex.state=false;
        clearLocal("codex.state("+uri+")");
        Codex.xstate=false;
    } Codex.clearState=clearState;

    var last_sync=false;
    // Post the current state and update synced state from what's
    // returned
    function syncState(force){
        if ((syncing)||(!(Codex.dosync))) return;
        if ((!(force))&&(last_sync)&&((fdjtTime.tick()-last_sync)<Codex.sync_interval)) {
            if (Codex.Trace.state)
                fdjtLog("Skipping state sync because it's too soon");
            return;}
        if ((!(force))&&(Codex.state)&&(!(hasClass(document.body,"cxFOCUS")))) {
            if (Codex.Trace.state)
                fdjtLog("Skipping state sync because page doesn't have focus");
            return;}
        if ((Codex.dosync)&&(navigator.onLine)) {
            var uri=Codex.docuri;
            var traced=(Codex.Trace.state)||(Codex.Trace.network);
            var state=Codex.state;
            var refuri=((Codex.target)&&(Codex.getRefURI(Codex.target)))||
                (Codex.refuri);
            var sync_uri="https://sync.sbooks.net/v1/sync"+
                "?REFURI="+encodeURIComponent(refuri)+
                "&DOCURI="+encodeURIComponent(Codex.docuri)+
                "&NOW="+fdjtTime.tick();
            Codex.last_sync=last_sync=fdjtTime.tick(); syncing=state;
            if (Codex.user) sync_uri=sync_uri+
                "&SYNCUSER="+encodeURIComponent(Codex.user._id);
            if (Codex.deviceName) sync_uri=sync_uri+
                "&DEVICE="+encodeURIComponent(Codex.deviceName);
            if (Codex.ends_at) sync_uri=sync_uri+
                "&LOCLEN="+encodeURIComponent(Codex.ends_at);
            if (state) {
                if (state.target) sync_uri=sync_uri+
                    "&TARGET="+encodeURIComponent(state.target);
                if ((state.location)||(state.hasOwnProperty('location')))
                    sync_uri=sync_uri+
                    "&LOCATION="+encodeURIComponent(state.location);
                if (state.changed) sync_uri=sync_uri+
                    "&CHANGED="+encodeURIComponent(state.changed);}
            var req=new XMLHttpRequest();
            syncing=state;
            req.onreadystatechange=function(evt){
                if (req.readyState===4) {
                    if ((req.status>=200)&&(req.status<300)) {
                        var xstate=JSON.parse(req.responseText);
                        if (xstate.changed) {
                            if (traced)
                                fdjtLog("syncState(callback) %o %j\n\t%j",
                                        evt,xstate,Codex.state);
                            if (!(Codex.state)) {
                                Codex.xstate=xstate;
                                restoreState(xstate);}
                            else if ((Codex.state.changed>xstate.changed)&&
                                     (Codex.state.maxloc>xstate.maxloc))
                                Codex.xstate=xstate;
                            else {
                                Codex.xstate=xstate;
                                Codex.resolveXState(xstate);}}
                        else if (traced)
                            fdjtLog("syncState(callback/error) %o %d %s",
                                    evt,req.status,req.responseText);}
                    if (navigator.onLine) setConnected(true);
                    syncing=false;}};
            req.withCredentials=true;
            if (traced) fdjtLog("syncState(call) %s",sync_uri);
            try {
                req.open("GET",sync_uri,true);
                req.send();}
            catch (ex) {
                try {
                    fdjtLog.warn(
                        "Sync request %s returned status %d %j, pausing",
                        uri,req.status,JSON.parse(req.responseText));}
                catch (err) {
                    fdjtLog.warn(
                        "Sync request %s returned status %d, pausing",
                        uri,req.status);}
                Codex.dosync=false;
                setTimeout(function(){Codex.dosync=true;},15*60*1000);}}
    } Codex.syncState=syncState;

    function forceSync(){
        if (Codex.connected) Codex.update();
        else if (Codex._onconnect)
            Codex._onconnect.push(function(){Codex.update();});
        else Codex._onconnect=[function(){Codex.update();}];
        if (!(Codex.syncstart)) Codex.syncLocation();
        else syncState();
    } Codex.forceSync=forceSync;

    function getLocInfo(elt){
        var eltid=false;
        var counter=0; var lim=200;
        var forward=fdjtDOM.forward;
        while ((elt)&&(counter<lim)) {
            eltid=elt.codexbaseid||elt.id;
            if ((eltid)&&(Codex.docinfo[eltid])) break;
            else {counter++; elt=forward(elt);}}
        if ((eltid)&&(Codex.docinfo[eltid])) {
            var info=Codex.docinfo[eltid];
            return {start: info.starts_at,end: info.ends_at,
                    len: info.ends_at-info.starts_at};}
        else return false;
    } Codex.getLocInfo=getLocInfo;

    function resolveLocation(loc){
        var allinfo=Codex.docinfo._allinfo;
        var i=0; var lim=allinfo.length;
        while (i<lim) {
            if (allinfo[i].starts_at<loc) i++;
            else break;}
        while (i<lim)  {
            if (allinfo[i].starts_at>loc) break;
            else i++;}
        return cxID(allinfo[i-1].frag);
    } Codex.resolveLocation=resolveLocation;

    // This moves within the document in a persistent way
    function codexGoTo(arg,caller,istarget,savestate,skiphist){
        if (typeof istarget === 'undefined') istarget=true;
        if (typeof savestate === 'undefined') savestate=true;
        var target, location, locinfo;
        if (!(arg)) {
            fdjtLog.warn("falsy arg (%s) to codexGoTo from %s",arg,caller);
            return;}
        if (typeof arg === 'string') {
            target=cxID(arg);
            locinfo=getLocInfo(target);
            location=locinfo.start;}
        else if (typeof arg === 'number') {
            location=arg;
            target=((istarget)&&
                    (((istarget.nodeType)&&(istarget.id))?(istarget):
                     (resolveLocation(arg))));}
        else if (arg.nodeType) {
            target=getTarget(arg);
            locinfo=getLocInfo(arg);
            location=locinfo.start;}
        else {
            fdjtLog.warn("Bad codexGoTo %o",arg);
            return;}
        if ((istarget)&&(istarget.nodeType)) target=istarget;
        else if ((typeof istarget === "string")&&(cxID(istarget)))
            target=cxID(istarget);
        else {}
        var info=(target)&&
            Codex.docinfo[target.getAttribute("data-baseid")||target.id];
        var page=((Codex.bypage)&&(Codex.layout)&&
                  (Codex.getPage(target,location)));
        var pageno=(page)&&(parseInt(page.getAttribute("data-pagenum"),10));
        if (!(target)) {
            if (Codex.layout instanceof fdjt.CodexLayout)
                Codex.GoToPage(arg,caller,savestate);
            else if (arg.nodeType) {
                var scan=arg;
                while (scan) {
                    if (scan.offsetTop) break;
                    else scan=scan.parentNode;}
                if (scan) Codex.content.style.offsetTop=-(scan.offsetTop);}
            else {}
            if (Codex.curpage)
                saveState({location: Codex.location,
                           page: Codex.curpage,
                           npages: Codex.pagecount},
                          true);
            else saveState({location: Codex.location},true);
            return;}
        var targetid=target.codexbaseid||target.id;
        if (Codex.Trace.nav)
            fdjtLog("Codex.GoTo%s() #%o@P%o/L%o %o",
                    ((caller)?("/"+caller):""),targetid,pageno,
                    ((info)&&(info.starts_at)),target);
        if (info) {
            Codex.point=target;
            if (!((Codex.hudup)||(Codex.mode))) Codex.scanning=false;}
        setHead(target);
        setLocation(location);
        if ((istarget)&&(targetid)&&(!(inUI(target)))) setTarget(target);
        if ((savestate)&&(istarget))
            Codex.saveState({
                target: (target.getAttribute("data-baseid")||target.id),
                location: location,page: pageno,npages: Codex.pagecount},
                           skiphist);
        else if (savestate)
            Codex.saveState({location: location,page: pageno,
                             npages: Codex.pagecount},
                           skiphist);
        else if (skiphist) {}
        else if (istarget)
            setHistory({
                target: (target.getAttribute("data-baseid")||target.id),
                location: location,page: pageno,npages: Codex.pagecount});
        else setHistory({
            target: (target.getAttribute("data-baseid")||target.id),
            location: location,page: pageno,npages: Codex.pagecount});
        if (page)
            Codex.GoToPage(page,caller||"codexGoTo",false,true);
        else {
            if (Codex.previewing)
                Codex.stopPreview(((caller)?("goto/"+caller):("goto")),target);
            var offinfo=fdjtDOM.getGeometry(target,Codex.content);
            var use_top=offinfo.top-((fdjtDOM.viewHeight()-50)/2);
            if (use_top<0) use_top=0;
            window.scrollTo(0,use_top);}
        Codex.location=location;
    } Codex.GoTo=codexGoTo;

    function anchorFn(evt){
        var target=fdjtUI.T(evt);
        while (target)
            if (target.href) break; else target=target.parentNode;
        if ((target)&&(target.href)&&(target.href[0]==='#')) {
            var elt=cxID(target.href.slice(1));
            if (elt) {Codex.GoTo(elt,"anchorFn"); fdjtUI.cancel(evt);}}}
    Codex.anchorFn=anchorFn;

    // This jumps and disables the HUD at the same time
    function CodexJumpTo(target){
        if (Codex.hudup) Codex.setMode(false);
        Codex.GoTo(target,"JumpTo");}
    Codex.JumpTo=CodexJumpTo;

    // This jumps and disables the HUD at the same time
    // We try to animate the transition
    function CodexScanTo(target){
        if (Codex.hudup) { // Figure out what mode to go to
            var headinfo=Codex.docinfo[target]||Codex.docinfo[target.id];
            if ((headinfo)&&((!(headinfo.sub))||(headinfo.sub.length===0)))
                Codex.setMode("tocscan");}
        Codex.GoTo(target,"CodexScanTo");}
    Codex.ScanTo=CodexScanTo;

    // Preview functions
    var oldscroll=false, preview_elt=false;
    function scrollPreview(elt,caller){
        var xoff=window.scrollLeft||0, yoff=window.scrollTop||0;
        if (elt) {
            if (elt.frag) elt=elt.frag;
            if (typeof elt==="string") elt=cxID(elt);
            if (!(elt)) return;
            else preview_elt=elt;
            if (!(oldscroll)) oldscroll={x: 0,y: yoff};
            var offinfo=fdjtDOM.getGeometry(elt,Codex.content);
            if (Codex.Trace.flips)
                fdjtLog("startScrollPreview/%s to %d for %o",
                        caller||"nocaller",offinfo.top-100,elt);
            // Codex.content.style.top=(-offinfo.top)+"px";
            var use_top=offinfo.top-((fdjtDOM.viewHeight()-50)/2);
            if (use_top<0) use_top=0;
            window.scrollTo(0,use_top);}
        else if (oldscroll) {
            if (Codex.Trace.flips)
                fdjtLog("stopScrollPreview/%s to %j from %d,%d(%o)",
                        caller||"nocaller",oldscroll,xoff,yoff,
                        preview_elt);
            preview_elt=false;
            window.scrollTo(oldscroll.x,oldscroll.y);
            oldscroll=false;}
        else {
            if (Codex.Trace.flips)
                fdjtLog("stopScrollPreview/%s to %j from %d,%d(%o)",
                        caller||"nocaller",oldscroll,xoff,yoff,
                        preview_elt);
            preview_elt=false; oldscroll=false;}}
    
    function clearPreview(){
        var current=fdjtDOM.$(".codexpreviewtarget");
        var i=0, lim=current.length; while (i<lim) {
            var p=current[i++];
            dropClass(p,"codexpreviewtarget");
            Codex.clearHighlights(p);}}

    function startPreview(spec,caller){
        var target=((spec.nodeType)?(spec):(cxID(spec)));
        if (Codex.Trace.flips)
            fdjtLog("startPreview %o (%s)",target,caller);
        if (target===Codex.previewing) {}
        else if (Codex.layout instanceof fdjt.CodexLayout) {
            var dups=((getTarget(target))&&(Codex.getDups(target)));
            Codex.startPagePreview(target,caller);
            if (dups) addClass(dups,"codexpreviewtarget");}
        else {
            scrollPreview(target,caller);
            addClass(target,"codexpreviewtarget");}
        Codex.previewing=target;
        addClass(document.body,"cxPREVIEW");
        if (hasClass(target,"codexpage")) addClass(document.body,"cxPAGEPREVIEW");
        return target;}
    Codex.startPreview=startPreview;
    function stopPreview(caller,jumpto){
        clearPreview();
        if ((jumpto)&&(!(jumpto.nodeType)))
            jumpto=Codex.previewTarget||Codex.previewing;
        if (Codex.Trace.flips)
            fdjtLog("stopPreview/%s jump to %o",caller||"nocaller",jumpto);
        if (Codex.layout instanceof fdjt.CodexLayout) {
            Codex.stopPagePreview(caller,jumpto);}
        else if (!(jumpto)) scrollPreview(false,caller);
        else if (jumpto===Codex.previewing) {
            oldscroll=false; scrollPreview(false,caller);}
        else scrollPreview(false,caller);
        Codex.previewing=false;
        dropClass(document.body,"cxPREVIEW");
        dropClass(document.body,"cxPAGEPREVIEW");
        if (jumpto) {
            if (Codex.hudup) Codex.setHUD(false);
            codexGoTo(jumpto);}
        return false;}
    Codex.stopPreview=stopPreview;

    function getLevel(elt){
        if (elt.toclevel) {
            if (elt.toclevel==='none') {
                elt.toclevel=false;
                return false;}
            else return elt.toclevel;}
        var attrval=
            ((elt.getAttributeNS)&&
             (elt.getAttributeNS('toclevel','http://sbooks.net')))||
            (elt.getAttribute('toclevel'))||
            (elt.getAttribute('data-toclevel'));
        if (attrval) {
            if (attrval==='none') return false;
            else return parseInt(attrval,10);}
        if (elt.className) {
            var cname=elt.className;
            if (cname.search(/\bsbooknotoc\b/)>=0) return 0;
            if (cname.search(/\bsbookignore\b/)>=0) return 0;
            var tocloc=cname.search(/\bsbook\d+(head|sect)\b/);
            if (tocloc>=0)
                return parseInt(cname.slice(tocloc+5),10);}
        if ((Codex.notoc)&&(Codex.notoc.match(elt))) return 0;
        if ((Codex.ignore)&&(Codex.ignore.match(elt))) return 0;
        if ((typeof Codex.autotoc !== 'undefined')&&(!(Codex.autotoc)))
            return false;
        if ((elt.tagName==='HGROUP')||(elt.tagName==='HEADER'))
            return getFirstTocLevel(elt,true);
        if (elt.tagName.search(/H\d/)===0)
            return parseInt(elt.tagName.slice(1,2),10);
        else return false;}

    function getFirstTocLevel(node,notself){
        if (node.nodeType!==1) return false;
        var level=((!(notself))&&(getLevel(node)));
        if (level) return level;
        var children=node.childNodes;
        var i=0; var lim=children.length;
        while (i<lim) {
            var child=children[i++];
            if (child.nodeType!==1) continue;
            level=getFirstTocLevel(child);
            if (level) return level;}
        return false;}

    Codex.getTOCLevel=getLevel;
    
    function getCover(){
        if (Codex.cover) return Codex.cover;
        var cover=fdjtID("SBOOKCOVERPAGE")||fdjtID("COVERPAGE");
        if (cover) {}
        else if (Codex.coverpage) {
            cover=fdjtDOM.Image(
                Codex.coverpage,"img.codexfullpage.codexcoverpage.sbookpage#CODEXCOVERPAGE");
            fdjtDOM.prepend(Codex.content,cover);}
        // This should generate a textual cover page
        else if ((!(fdjt.ID("CODEXTITLEPAGE")))&&
                 (!(fdjt.ID("SBOOKTITLEPAGE")))) {
            cover=fdjtDOM("div.codexcoverpage.codexfullpage#SBOOKTITLEPAGE","\n",
                          ((Codex.booktitle)?
                           (fdjtDOM("h1.title",Codex.booktitle)):
                           null),
                          "\n",
                          ((Codex.bookauthor)?
                           (fdjtDOM("h1.author",Codex.bookauthor)):
                           null));
            fdjtDOM.prepend(Codex.content,cover);}
        if (cover) Codex.cover=cover;
        return cover;}
    Codex.getCover=getCover;

    function fixStaticRefs(string){
        return string.replace(
                /http:\/\/static.beingmeta.com\//g,Codex.root)
            .replace(/{{bmg}}/g,Codex.root+"g/");}
    Codex.fixStaticRefs=fixStaticRefs;
    
})();

/* Adding qricons */

/*
  function sbookAddQRIcons(){
  var i=0;
  while (i<Codex.heads.length) {
  var head=Codex.heads[i++];
  var id=head.id;
  var title=(head.sbookinfo)&&sbook_get_titlepath(head.sbookinfo);
  var qrhref="https://"+Codex.server+"/glosses/qricon.png?"+
  "URI="+encodeURIComponent(Codex.docuri||Codex.refuri)+
  ((id)?("&FRAG="+head.id):"")+
  ((title) ? ("&TITLE="+encodeURIComponent(title)) : "");
  var qricon=fdjtDOM.Image(qrhref,".sbookqricon");
  fdjtDOM.prepend(head,qricon);}}
*/

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
