/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/search.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file implements the search component for the e-reader web
   application, and relies heavily on the Knodules module.

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

(function(){
    "use strict";
    var fdjtString=fdjt.String;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var fdjtID=fdjt.ID;
    var RefDB=fdjt.RefDB, Query=RefDB.Query; 

    Codex.search_cloud=false;
    if (!(Codex.empty_cloud)) Codex.empty_cloud=false;
    if (!(Codex.show_refiners)) Codex.show_refiners=25;
    if (!(Codex.search_gotlucky)) Codex.search_gotlucky=7;
    
    var addClass=fdjtDOM.addClass;
    var dropClass=fdjtDOM.dropClass;
    var getChild=fdjtDOM.getChild;
    var log=fdjtLog;
    var kbref=RefDB.resolve;

    /* Query functions */

    /* Set on main search input */
    // id="CODEXSEARCHINPUT" 
    // completions="CODEXSEARCHCLOUD"

    Codex.getQuery=function(){return Codex.query;};
    
    function setQuery(query){
        if (Codex.Trace.search) log("Setting working query to %o",query);
        var qstring=query.getString();
        if (qstring!==Codex.qstring) {
            Codex.query=query;
            Codex.qstring=qstring;
            if (query.tags.length===0)  {
                addClass(Codex.HUD,"emptysearch");
                Codex.empty_cloud.dom.style.fontSize="";
                Codex.search_cloud=Codex.empty_cloud;}
            else {
                var cloud=Codex.queryCloud(query);
                dropClass(Codex.HUD,"emptysearch");
                fdjtDOM.replace("CODEXSEARCHCLOUD",cloud.dom);
                Codex.search_cloud=cloud;}
            useQuery(query,fdjtID("CODEXSEARCH"));}
        if (Codex.mode==="refinesearch") {
            if (query.results.length===0) {}
            else if (query.results.length<7)
                showSearchResults();
            else {fdjtID("CODEXSEARCHINPUT").focus();}}}

    Codex.setQuery=setQuery;

    function useQuery(query,box_arg){
        if (query instanceof Query) query=query;
        else query=new Codex.Query(query);
        var qstring=query.getString();
        if ((box_arg)&&(typeof box_arg === 'string'))
            box_arg=document.getElementById(box_arg);
        var box=box_arg||query._box||fdjtID("CODEXSEARCH");
        if ((query.dom)&&(box)&&(box!==query.dom))
            fdjtDOM.replace(box_arg,query.dom);
        box.setAttribute("qstring",qstring);
        query.execute();
        query.getCoTags();
        if (Codex.Trace.search>1)
            log("Setting query for %o to %o: %o/%o (%o)",
                box,query.tags,
                query.results.length,query.cotags.length,
                qstring);
        else if (Codex.Trace.search)
            log("Setting query for %o to %o: %d results/%d refiners (%o)",
                box,query.tags,
                query.results.length,query.cotags.length,
                qstring);
        var input=getChild(box,".searchinput");
        var cloudid=input.getAttribute("completions");
        var infoid=input.getAttribute("info");
        var qtags=getChild(box,".qtags")||fdjtID("CODEXSEARCHTAGS");
        var cloud=((cloudid)&&(fdjtID(cloudid)));
        /* These should possibly be used in initializing the .listing
         * field of the query */
        //var resultsid=input.getAttribute("results");
        //var results=((resultsid)&&(fdjtID(resultsid)));
        var info=((infoid)&&(fdjtID(infoid)));
        var resultcount=getChild(info,".resultcount");
        var refinecount=getChild(info,".refinecount");
        // Update (clear) the input field
        input.value='';
        var elts=query.tags; var i=0; var lim=elts.length;
        // Update 'notags' class
        if (elts.length) fdjtDOM.dropClass(Codex.HUD,"emptysearch");
        else addClass(Codex.HUD,"emptysearch");
        // Update the query tags
        var newtags=fdjtDOM("div.qtags");
        while (i<lim) {
            var tag=elts[i];
            if (typeof tag === 'string') tag=kbref(tag)||tag;
            fdjtDOM(newtags,((i>0)&&("\u00a0\u00B7 ")),Codex.cloudEntry(tag));
            i++;}
        if (qtags.id) newtags.id=qtags.id;
        fdjtDOM.replace(qtags,newtags);
        // Update the results display
        if (query.results.length) {
            resultcount.innerHTML=query.results.length+
                " result"+((query.results.length===1)?"":"s");
            fdjtDOM.dropClass([box,info],"noresults");}
        else {
            resultcount.innerHTML="no results";
            addClass([box,info],"noresults");}
        // Tweak font size for qtags
        newtags.setAttribute("data-maxfont","120%");
        newtags.setAttribute("data-min","60%");
        fdjt.DOM.tweakFont(newtags);
        /*
            fdjt.UI.adjustFont.tweakUntil(
            function(){
                if (info.scrollHeight<=info.clientHeight)
                    return 0;
                else return 1;},
            newtags,{maxpct: 120,minpct: 60},[5,1]);
        */
        // Update the search cloud
        var n_refiners=((query.cotags)&&(query.cotags.length))||0;
        var completions=Codex.queryCloud(query);
        refinecount.innerHTML=n_refiners+
            ((n_refiners===1)?(" co-tag"):(" co-tags"));
        fdjtDOM.dropClass(box,"norefiners");
        if (query.tags.length===0) {
            fdjtDOM.replace(
                "CODEXSEARCHCLOUD",fdjtDOM("div#CODEXSEARCHCLOUD"));
            Codex.empty_cloud.dom.style.fontSize="";
            Codex.empty_cloud.complete("");}
        else {
            if (cloudid) completions.id=cloudid;
            if (Codex.Trace.search>1)
                log("Setting search cloud for %o to %o",box,completions.dom);
            cloudid=cloud.id;
            addClass(completions.dom,"hudpanel");
            fdjtDOM.replace(cloud,completions.dom);
            completions.dom.style.fontSize="";
            completions.complete("");
            Codex.adjustCloudFont(completions);}
        if (n_refiners===0) {
            addClass(box,"norefiners");
            refinecount.innerHTML="no refiners";}
        query._box=box; box.setAttribute("qstring",qstring);
        Codex.UI.updateScroller(completions.dom);
        return query;}
    Codex.useQuery=useQuery;

    function extendQuery(query,elt){
        var elts=[].concat(query.tags);
        if (typeof elt === 'string') 
            elts.push(kbref(elt)||elt);
        else elts.push(elt);
        return useQuery(new Codex.Query(elts),query._box);}
    Codex.extendQuery=extendQuery;

    Codex.updateQuery=function(input_elt){
        var q=Knodule.Query.string2query(input_elt.value);
        if ((q)!==(Codex.query.tags))
            Codex.setQuery(q,false);};

    function showSearchResults(){
        var results=Codex.query.showResults();
        addClass(results,"hudpanel");
        fdjtDOM.replace("CODEXSEARCHRESULTS",results);
        Codex.setMode("searchresults");
        fdjtID("CODEXSEARCHINPUT").blur();
        fdjtID("CODEXSEARCHRESULTS").focus();
        Codex.UI.updateScroller(fdjtID("CODEXSEARCHRESULTS"));}
    Codex.showSearchResults=showSearchResults;

    /* Call this to search */

    function startSearch(tag){
        setQuery([tag]);
        Codex.setMode("refinesearch");}
    Codex.startSearch=startSearch;

    /* Text input handlers */

    var Selector=fdjtDOM.Selector;
    
    function searchInput_keyup(evt){
        evt=evt||window.event||null;
        var ch=evt.charCode||evt.keyCode;
        var target=fdjtDOM.T(evt), completeinfo=false, completions=false;
        // fdjtLog("Input %o on %o",evt,target);
        // Clear any pending completion calls
        if ((ch===13)||(ch===13)||(ch===59)||(ch===93)) {
            var qstring=target.value;
            if (fdjtString.isEmpty(qstring)) showSearchResults();
            else {
                completeinfo=Codex.queryCloud(Codex.query);
                if (completeinfo.timer) {
                    clearTimeout(completeinfo.timer);
                    completeinfo.timer=false;}
                completions=completeinfo.complete(qstring);
                var completion=(completeinfo.selection)||
                    completeinfo.select(new Selector(".cue"))||
                    completeinfo.select();
                // Signal error?
                if (!(completion)) {
                    var found=Codex.docdb.find("~tags",qstring);
                    if ((found)&&(found.length))
                        setQuery(extendQuery(Codex.query,qstring));
                    return;}
                var value=completeinfo.getValue(completion);
                setQuery(extendQuery(Codex.query,value));}
            fdjtDOM.cancel(evt);
            if ((Codex.search_gotlucky) && 
                (Codex.query.results.length>0) &&
                (Codex.query.results.length<=Codex.search_gotlucky))
                showSearchResults();
            else {
                /* Handle new info */
                completeinfo=Codex.queryCloud(Codex.query);
                completeinfo.complete("");}
            return false;}
        else if (ch===9) { /* tab */
            var partial_string=target.value;
            completeinfo=Codex.queryCloud(Codex.query);
            completions=completeinfo.complete(partial_string);
            fdjtUI.cancel(evt);
            if (completions.prefix!==partial_string) {
                target.value=completions.prefix;
                fdjtDOM.cancel(evt);
                setTimeout(function(){
                    Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
                           100);
                return;}
            else if (evt.shiftKey) completeinfo.selectPrevious();
            else completeinfo.selectNext();}
        else {
            completeinfo=Codex.queryCloud(Codex.query);
            completeinfo.docomplete(target);
            setTimeout(function(){
                Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
                       100);}}
    Codex.UI.handlers.search_keyup=searchInput_keyup;

    function searchUpdate(input,cloud){
        if (!(input)) input=fdjtID("CODEXSEARCHINPUT");
        if (!(cloud)) cloud=Codex.queryCloud(Codex.query);
        cloud.complete(input.value);}
    Codex.searchUpdate=searchUpdate;

    function searchInput_focus(evt){
        evt=evt||window.event||null;
        var input=fdjtDOM.T(evt);
        Codex.setFocus(input);
        if ((Codex.mode)&&(Codex.mode==='searchresults'))
            Codex.setMode("refinesearch");
        searchUpdate(input);}
    Codex.UI.handlers.search_focus=searchInput_focus;

    function searchInput_blur(evt){
        evt=evt||window.event||null;
        var input=fdjtDOM.T(evt);
        Codex.clearFocus(input);}
    Codex.UI.handlers.search_blur=searchInput_blur;

    function clearSearch(evt){
        var target=fdjtUI.T(evt||window.event);
        var box=fdjtDOM.getParent(target,".searchbox");
        var input=getChild(box,".searchinput");
        fdjtUI.cancel(evt);
        if ((Codex.query.tags.length===0)&&
            (input.value.length===0)) {
            Codex.setMode(false); return;}
        else {
            Codex.empty_cloud.dom.style.fontSize="";
            setQuery(Codex.empty_query);
            input.value="";}
        input.focus();}
    Codex.UI.handlers.clearSearch=clearSearch;
    
    Codex.toggleSearch=function(evt){
        evt=evt||window.event;
        if ((Codex.mode==="refinesearch")||
            (Codex.mode==="searchresults"))
            Codex.setMode(false);
        else {
            Codex.setMode("refinesearch");
            fdjtID("CODEXSEARCHINPUT").focus();}
        fdjtUI.cancel(evt);};
    
    /* Search result listings */

    var CodexSlice=Codex.Slice;
    function SearchResults(query){
        if (!(this instanceof SearchResults))
            return new SearchResults(query);
        this.query=query; this.results=query.results;
        return CodexSlice.call(
            this,fdjtDOM("div.codexslice.sbookresults"),this.results);}
    Codex.SearchResults=SearchResults;

    SearchResults.prototype=new CodexSlice();
    SearchResults.prototype.renderCard=function renderSearchResult(result){
        return Codex.renderCard(result,this.query);};
    SearchResults.prototype.sortfn=function searchResultsSortFn(x,y){
        if (x.score) {
            if (y.score) {
                if (x.score===y.score) {
                    if (x.location) {
                        if (y.location) {
                            if (x.location===y.location) {
                                if (x.timestamp) {
                                    if (y.timestamp)
                                        return x.timestamp-y.timestamp;
                                    else return -1;}
                                else return 1;}
                            else return x.location-y.location;}
                        else return -1;}}
                else return (y.score-x.score);}
            else return -1;}
        else return 1;};

    /* Show search results */

    function showResults(query){
        if (query.listing) return query.listing.container;
        else query.listing=new SearchResults(query);
        var div=query.listing.container;
        return div;}
    RefDB.Query.prototype.showResults=
        function(){return showResults(this);};
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
