/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/search.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

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

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
var Codex=((typeof Codex !== "undefined")?(Codex):({}));
var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

(function(){
    var fdjtString=fdjt.String;
    var fdjtState=fdjt.State;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var fdjtKB=fdjt.KB, fdjtID=fdjt.ID;
    var RefDB=fdjt.RefDB, Ref=fdjt.Ref, Query=RefDB.Query; 
    var KNode=Knodule.KNode;

    var cloudEntry=Codex.cloudEntry;

    Codex.search_cloud=false;
    if (!(Codex.empty_cloud)) Codex.empty_cloud=false;
    if (!(Codex.show_refiners)) Codex.show_refiners=25;
    if (!(Codex.search_gotlucky)) Codex.search_gotlucky=7;
    
    var cxicon=Codex.icon;

    var Completions=fdjtUI.Completions;
    var addClass=fdjtDOM.addClass;
    var getChildren=fdjtDOM.getChildren;
    var getChild=fdjtDOM.getChild;
    var log=fdjtLog;
    var kbref=RefDB.resolve;

    /* Query functions */

    /* Set on main search input */
    // id="CODEXSEARCHINPUT" 
    // completions="CODEXSEARCHCLOUD"

    Codex.getQuery=function(){return Codex.query;}
    
    function setQuery(query){
        if (Codex.Trace.search) log("Setting working query to %o",query);
        var qstring=query.getString();
        if (qstring!==Codex.qstring) {
            Codex.query=query;
            Codex.qstring=qstring;
            var cloud=queryCloud(query);
            fdjtDOM.replace("CODEXSEARCHCLOUD",cloud.dom);
            useQuery(query,fdjtID("CODEXSEARCH"));}
        if (Codex.mode==="search") {
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
        var resultsid=input.getAttribute("results");
        var infoid=input.getAttribute("info");
        var qtags=getChild(box,".qtags");
        var cloud=((cloudid)&&(fdjtID(cloudid)))||
            getChild(block,".searchcloud");
        var results=((resultsid)&&(fdjtID(resultsid)))||
            getChild(block,".searchresults");
        var info=((infoid)&&(fdjtID(infoid)))||
            getChild(block,".searchresults");
        var resultcount=getChild(info,".resultcount");
        var refinecount=getChild(info,".refinecount");
        // Update (clear) the input field
        input.value='';
        var elts=query.tags; var i=0; var lim=elts.length;
        // Update 'notags' class
        if (elts.length) fdjtDOM.dropClass([box,info],"notags");
        else addClass([box,info],"notags");
        // Update the query tags
        var newtags=fdjtDOM("span.qtags");
        while (i<lim) {
            var tag=elts[i];
            if (typeof tag === 'string') tag=kbref(tag)||tag;
            if (i>0) fdjtDOM(newtags," \u00B7 ");
            // Handle section references as tags
            if ((typeof tag === "string")&&(tag[0]==="\u00A7")) {
                var showname=tag;
                if (tag.length>20) {
                    var start=tag.indexOf(' ',8);
                    var end=tag.lastIndexOf(' ',showname.length-8);
                    if (start<0) start=8; if (end<0) end=showname.length-8;
                    if (start<(showname.length-end)) {
                        showname=showname.slice(0,start)+" \u2026 "+
                            showname.slice(end);}}
                var span=fdjtDOM("span.completion",
                                 fdjtDOM("span.sectname",showname));
                fdjtDOM(newtags,span);}
            else if (typeof tag === "string")
                fdjtDOM(newtags,fdjtDOM("span.rawterm",tag));
            else fdjtDOM(newtags,tag);
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
        // Update the search cloud
        var n_refiners=((query.cotags)&&(query.cotags.length))||0;
        var completions=Codex.queryCloud(query);
        refinecount.innerHTML=n_refiners+
            ((n_refiners===1)?(" associated tag"):(" associated tags"));
        fdjtDOM.dropClass(box,"norefiners");
        if (cloudid) completions.id=cloudid;
        if (Codex.Trace.search>1)
            log("Setting search cloud for %o to %o",box,completions.dom);
        cloudid=cloud.id;
        addClass(completions.dom,"hudpanel");
        fdjtDOM.replace(cloud,completions.dom);
        completions.complete("");
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
        Codex.setMode("search");}
    Codex.startSearch=startSearch;

    /* Text input handlers */

    var _sbook_searchupdate=false;
    var _sbook_searchupdate_delay=200;
    var Selector=fdjtDOM.Selector;
    
    function searchInput_keyup(evt){
        evt=evt||event||null;
        var ch=evt.charCode||evt.keyCode;
        var target=fdjtDOM.T(evt);
        // fdjtLog("Input %o on %o",evt,target);
        // Clear any pending completion calls
        if ((ch===13)||(ch===13)||(ch===59)||(ch===93)) {
            var qstring=target.value;
            if (fdjtString.isEmpty(qstring)) showSearchResults();
            else {
                var completeinfo=queryCloud(Codex.query);
                if (completeinfo.timer) {
                    clearTimeout(completeinfo.timer);
                    completeinfo.timer=false;}
                var completions=completeinfo.complete(qstring);
                var completion=(completeinfo.selection)||
                    completeinfo.select(new Selector(".cue"))||
                    completeinfo.select();
                // Signal error?
                if (!(completion)) return;
                var value=completeinfo.getValue(completion);
                setQuery(extendQuery(Codex.query,value));}
            fdjtDOM.cancel(evt);
            if ((Codex.search_gotlucky) && 
                (Codex.query.results.length>0) &&
                (Codex.query.results.length<=Codex.search_gotlucky))
                showSearchResults();
            else {
                /* Handle new info */
                var completeinfo=queryCloud(Codex.query);
                completeinfo.complete("");}
            return false;}
        else if (ch===9) { /* tab */
            var qstring=target.value;
            var completeinfo=queryCloud(Codex.query);
            var completions=completeinfo.complete(qstring);
            fdjtUI.cancel(evt);
            if (completions.prefix!==qstring) {
                target.value=completions.prefix;
                fdjtDOM.cancel(evt);
                setTimeout(function(){
                    Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
                           100);
                return;}
            else if (evt.shiftKey) completeinfo.selectPrevious();
            else completeinfo.selectNext();}
        else {
            var completeinfo=queryCloud(Codex.query);
            completeinfo.docomplete(target);
            setTimeout(function(){
                Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
                       100);}}
    Codex.UI.handlers.search_keyup=searchInput_keyup;

    function searchUpdate(input,cloud){
        if (!(input)) input=fdjtID("CODEXSEARCHINPUT");
        if (!(cloud)) cloud=queryCloud(Codex.query);
        cloud.complete(input.value);}
    Codex.searchUpdate=searchUpdate;

    function searchInput_focus(evt){
        evt=evt||event||null;
        var input=fdjtDOM.T(evt);
        Codex.setFocus(input);
        sbook_search_focus=true;
        if ((Codex.mode)&&(Codex.mode==='searchresults'))
            Codex.setMode("search");
        searchUpdate(input);}
    Codex.UI.handlers.search_focus=searchInput_focus;

    function searchInput_blur(evt){
        evt=evt||event||null;
        Codex.setFocus(false);
        sbook_search_focus=false;}
    Codex.UI.handlers.search_blur=searchInput_blur;

    function clearSearch(evt){
        var target=fdjtUI.T(evt||event);
        var box=fdjtDOM.getParent(target,".searchbox");
        var input=getChild(box,".searchinput");
        fdjtUI.cancel(evt);
        if (Codex.query.tags.length===0) {
            Codex.setMode(false); return;}
        else setQuery(Codex.empty_query);
        input.focus();}
    Codex.UI.handlers.clearSearch=clearSearch;
    
    Codex.toggleSearch=function(evt){
        evt=evt||event;
        if ((Codex.mode==="search")||
            (Codex.mode==="searchresults"))
            Codex.setMode(false);
        else {
            Codex.setMode("search");
            fdjtID("CODEXSEARCHINPUT").focus();}
        fdjtUI.cancel(evt);};
    
    /* Show search results */

    function makelocrule(target_info,cxtinfo_arg,cxtname){
        var cxtinfo=cxtinfo_arg||Codex.docinfo[(Codex.body||document.body).id];
        if (!(cxtname)) {
            if (cxtinfo_arg) cxtname="into the section";
            else cxtname="into the book";}
        var locrule=fdjtDOM("hr.locrule");
        var cxt_start=cxtinfo.starts_at;
        var cxt_end=cxtinfo.ends_at;
        var cxt_len=cxt_end-cxt_start;
        var target_start=target_info.starts_at-cxt_start;
        var target_len=target_info.ends_at-target_info.starts_at;
        var locstring="~"+Math.ceil(target_len/5)+ " words long ~"+
            Math.ceil((target_start/cxt_len)*100)+"% "+cxtname;
        locrule.setAttribute("about","#"+(target_info.id||target_info.frag));
        locrule.locstring=locstring+".";
        locrule.title=locstring+": click or hold to glimpse";
        locrule.style.width=((target_len/cxt_len)*100)+"%";
        locrule.style.left=((target_start/cxt_len)*100)+"%";
        return locrule;}

    function showResults(query){
        if (query.listing) return query.listing;
        var results=query.results; var rscores=query.scores;
        var scores={}; var sorted=[];
        var i=0; var lim=results.length;
        var scores=new Array(lim);
        while (i<lim) {
            var r=results[i++];
            var ref=Codex.docinfo[r]||Codex.glossdb.refs[r]||kbref(r)||r;
            if (!(ref)) continue;
            var frag=ref.frag;
            if (!(frag)) continue;
            sorted.push(ref);
            if (scores[frag]) 
                scores[frag]=scores[frag]+(rscores[r]||1);
            else {
                scores[frag]=rscores[r];}
            i++;}
        sorted.sort(function(x,y){
            var xfrag=x.frag; var yfrag=y.frag;
            if (xfrag===yfrag) {}
            else if (scores[x.frag]>scores[yfrag]) return -1;
            else if (scores[xfrag]<scores[yfrag]) return 1;
            var xqid=x._id; var yqid=y._id;
            if (rscores[xqid]>rscores[yqid]) return -1;
            else if (rscores[xqid]<rscores[yqid]) return 1;
            var xstart=x.starts_at; var ystart=y.starts_at;
            if (xstart<ystart) return -1;
            else if (xstart>ystart) return 1;
            var xend=x.ends_at; var yend=y.ends_at;
            if (xend<yend) return -1;
            else if (xend>yend) return 1;
            else return 0;});
        var div=fdjtDOM("div.codexslice.sbookresults");
        fdjtUI.TapHold(div,Codex.touch);
        Codex.UI.addHandlers(div,'summary');
        Codex.UI.showSlice(query.results,div,rscores);
        query.listing=div;
        return div;}
    RefDB.Query.prototype.showResults=
        function(){return showResults(this);};
    
    /* Getting query cloud */

    function queryCloud(query){
        if (query.cloud) return query.cloud;
        else if ((query.tags.length)===0) {
            query.cloud=Codex.empty_cloud;
            return query.cloud;}
        else {
            var cotags=query.getCoTags();
            var completions=makeCloud(cotags,query.tagscores,query.tagfreqs);
            var cloud=completions.dom;
            cloud.onclick=cloud_ontap;
            var n_refiners=cotags.length;
            var hide_some=(n_refiners>Codex.show_refiners);
            if (hide_some) {
                var cues=fdjtDOM.$(".cue",cloud);
                if (!((cues)&&(cues.length))) {
                    var compelts=fdjtDOM.$(".completion",cloud);
                    var i=0; var lim=((compelts.length<Codex.show_refiners)?
                                      (compelts.length):(Codex.show_refiners));
                    while (i<lim) addClass(compelts[i++],"cue");}}
            else addClass(cloud,"showempty");
            query.cloud=completions;
            // sortCloud(completions,Codex.empty_query.tagfreqs,Codex.empty_query.max_tagfreq);
            // sizeCloud(completions,query.tagscores,query.tagfreqs,true);
            return query.cloud;}}
    Codex.queryCloud=queryCloud;
    RefDB.Query.prototype.getCloud=function(){return queryCloud(this);};
    
    function tag_sorter(x,y,scores){
        // Knodes go before Refs go before strings
        // Otherwise, use scores
        if (x instanceof KNode) {
            if (y instanceof KNode) {} // Fall through
            else return -1;}
        else if (y instanceof Knode) return 1;
        else if (x instanceof Ref) { 
            if (y instanceof Ref) {} // Fall through
            else return -1;}
        else if (y instanceof Ref) return 1;
        else if ((typeof x === "string")&&
                 (typeof y === "string"))
        {}
        // We should never reach these cases because tags should
        //  always be strings, Refs, or KNodes.
        else if  (typeof x === typeof y) {
            if (x<y) return -1;
            else if (x>y) return 1;
            else return 0;}
        else {
            var xt=typeof x, yt=typeof y;
            if (xt<yt) return -1;
            else if (xt>yt) return 1;
            else return 0;}
        var xv=scores.get(x), yv=scores.get(y);
        if (typeof xv === "undefined") {
            if (typeof yv === "undefined") {
                var xid, yid;
                if (typeof x === "string") {
                    xid=x; yid=y;}
                else {
                    xid=x._qid||x.getQID();
                    yid=y._qid||y.getQID();}
                if (xid<yid) return -1;
                else if (yid>xid) return 1;
                else return 0;}
            else return 1;}
        else if (typeof yv === "undefined") return -1;
        else if (xv===yv) {
            if (x<y) return -1;
            else if (x>y) return 1;
            else return 0;}
        else if (xv>yv) return -1;
        else return 1;}
    Codex.tag_sorter=tag_sorter;
    function sort_tags(tags,scores){
        tags.sort(function(x,y){
            // Knodes go before Refs go before strings
            // Otherwise, use scores
            if (x instanceof KNode) {
                if (y instanceof KNode) {} // Fall through
                else return -1;}
            else if (y instanceof Knode) return 1;
            else if (x instanceof Ref) { 
                if (y instanceof Ref) {} // Fall through
                else return -1;}
            else if (y instanceof Ref) return 1;
            else if ((typeof x === "string")&&
                     (typeof y === "string"))
            {}
            // We should never reach these cases because tags should
            //  always be strings, Refs, or KNodes.
            else if  (typeof x === typeof y) {
                if (x<y) return -1;
                else if (x>y) return 1;
                else return 0;}
            else {
                var xt=typeof x, yt=typeof y;
                if (xt<yt) return -1;
                else if (xt>yt) return 1;
                else return 0;}
            var xv=scores.get(x), yv=scores.get(y);
            if (typeof xv === "undefined") {
                if (typeof yv === "undefined") {
                    var xid, yid;
                    if (typeof x === "string") {
                        xid=x; yid=y;}
                    else {
                        xid=x._qid||x.getQID();
                        yid=y._qid||y.getQID();}
                    if (xid<yid) return -1;
                    else if (yid>xid) return 1;
                    else return 0;}
                else return 1;}
            else if (typeof yv === "undefined") return -1;
            else if (xv===yv) {
                if (x<y) return -1;
                else if (x>y) return 1;
                else return 0;}
            else if (xv>yv) return -1;
            else return 1;});}
    Codex.sortTags=sort_tags;
    
    function sortCloud(cloud,scores){
        var values=[].concat(cloud.values);
        sort_tags(values,scores);
        var byvalue=cloud.byvalue;
        var holder=document.createDocumentFragment();
        var i=0, lim=values.length;
        while (i<lim) {
            var value=values[i++];
            var completion=byvalue.get(value);
            if (completion) {
                if (i>1) holder.appendChild(document.createTextNode(" "));
                holder.appendChild(completion);}}
        cloud.dom.appendChild(holder);}
    Codex.sortCloud=sortCloud;

    function sizeCloud(cloud,scores,freqs,cuethresh){
        var values=cloud.values, byvalue=cloud.byvalue;
        var elts=new Array(values.length), vscores=new Array(values.length);
        var i=0, lim=values.length, min_score=-1, max_score=0, score_sum=0;
        if (cuethresh===true) {
            while (i<lim) {
                var s=scores.get(values[i++]);
                if (s) score_sum=score_sum+s;}
            cuethresh=score_sum/values.length;}
        var global_scores=Codex.empty_query.tagscores;
        var total_results=Codex.empty_query.results.length;
        i=0; while (i<lim) {
            var value=values[i], score=scores.get(value);
            var elt=elts[i]=byvalue.get(value);
            if ((value.prime)||(
                (typeof cuethresh === "number")&&(score>cuethresh)))
                addClass(elt,"cue");
            if (score) {
                if (scores!==global_scores) 
                    score=score/(global_scores.get(value));
                else {
                    var valstring=((typeof value === "string")?(value):
                                   (value.dterm));
                    if (Codex.tagweights.get(valstring))
                        score=(score/total_results)/Codex.tagweights.get(value);
                    else score=1;}
                vscores[i]=score;
                if (score>max_score) max_score=score;
                if (min_score<0) min_score=score;
                else if (score<min_score) min_score=score;
                else {}}
            i++;}
        i=0; while (i<lim) {
            if (vscores[i]) {
                var factor=((vscores[i]-min_score)/(max_score-min_score));
                var factor=((Math.sqrt(vscores[i])-Math.sqrt(min_score))/
                            (Math.sqrt(max_score)-Math.sqrt(min_score)));
                var pct=50+150*factor;
                // var pct=50+100*Math.sin(1.5*((vscores[i]-min_score)/max_score));
                var node=elts[i]; var freq=freqs.get(values[i]);
                var title=((freq)&&(freq+" items; "))+"score="+vscores[i];
                // title=title+"; factor="+factor+"["+min_score+","+max_score+"]; "++"; pct="+pct+"%";
                node.title=title;
                node.style.fontSize=pct+"%";}
            i++;}}
    Codex.sizeCloud=sizeCloud;

    function cloud_ontap(evt){
        evt=evt||event;
        var target=fdjtDOM.T(evt);
        var completion=fdjtDOM.getParent(target,".completion");
        if (Codex.Trace.gestures) log("cloud tap on %o",completion);
        if (completion) {
            var cinfo=Codex.query.cloud;
            var value=cinfo.getValue(completion);
            if (typeof value !== 'string') add_searchtag(value);
            else  if (value.length===0) {}
            else if (value.indexOf('@')>=0)
                add_searchtag(kbref(value));
            else if ((Codex.knodule)&&(Codex.knodule.probe(value)))
                add_searchtag(Codex.knodule.probe(value));
            else add_searchtag(value);
            fdjtUI.cancel(evt);}
        else if (fdjtDOM.inherits(target,".resultcounts")) {
            showSearchResults(Codex.query);
            Codex.setMode("searchresults");
            fdjtID("CODEXSEARCHINPUT").blur();
            fdjtID("CODEXSEARCHRESULTS").focus();
            fdjtUI.cancel(evt);}
        else if (fdjtDOM.inherits(target,".refinercounts")) {
            var completions=fdjtDOM.getParent(target,".completions");
            fdjtDOM.toggleClass(completions,"showempty");
            fdjtDOM.cancel(evt);}
        else if (fdjtDOM.inherits(target,".maxcompletemsg")) {
            var completions=fdjtDOM.getParent(target,".completions");
            fdjtID("CODEXSEARCHINPUT").focus();
            fdjtDOM.toggleClass(container,"showall");
            fdjtDOM.cancel(evt);}
        else {}}
    Codex.UI.handlers.cloud_ontap=cloud_ontap;

    function makeCloud(dterms,scores,freqs,completions,init_cloud) {
        var start=new Date();
        var sourcedb=Codex.sourcedb;
        var knodule=Codex.knodule;
        var cloud=init_cloud||false;
        var i=0; var n_terms=dterms.length;
        // Move it out of the flow
        var placeholder=false;
        if ((init_cloud)&&(init_cloud.parentNode)) {
            placeholder=document.createTextNode("");
            init_cloud.parentNode.replaceChild(placeholder,init_cloud);}
        var info=organize_tags(dterms,scores,knodule,sourcedb);
        dterms=[].concat(dterms);
        sort_tags(dterms,Codex.empty_query.tagfreqs);
        var usecues=(n_terms>17)&& (// lots of terms AND
            (info.n_primes>0) || // there are prime terms OR
            (info.max!==info.min) || // scores are different OR
            // there are a small number of real concepts to use
            ((info.normals._count)<17) ||
                // there's are a lot of weak terms
                ((n_terms/info.normals._count)>4));
        if (cloud) {
            fdjtDOM.addClass(cloud,"completions");
            if (!(getChild(cloud,".showall")))
                fdjtDOM.prepend(cloud,getShowAll(usecues,n_terms));}
        else if ((completions)&&(completions.dom))
            cloud=completions.dom;
        else cloud=fdjtDOM("div.completions.cloud",getShowAll(usecues,n_terms));
        if (!(usecues)) fdjtDOM.addClass(cloud,"showempty");
        if (!(completions)) completions=new Completions(cloud);
        var score_sum=0; while (i<n_terms) {
            var score=scores.get(dterms[i++]);
            if (score) score_sum=score_sum+score;}
        i=0; while (i<n_terms) {
            var dterm=dterms[i++];
            var span=cloudSpan(completions,dterm,scores,freqs,score_sum/n_terms);
            cloud.appendChild(span);
            cloud.appendChild(document.createTextNode(" "));}
        sizeCloud(completions,scores,freqs,false);
        var maxmsg=fdjtDOM(
            "div.maxcompletemsg",
            "There are a lot ","(",fdjtDOM("span.completioncount","really"),")",
            " of completions.  ");
        fdjtDOM.prepend(cloud,maxmsg);
        var end=new Date();
        if (Codex.Trace.clouds)
            fdjtLog("Made cloud for %d dterms in %f seconds",
                    dterms.length,(end.getTime()-start.getTime())/1000);
        // Put it back in the flow if neccessary
        if (placeholder)
            placeholder.parentNode.replaceChild(cloud,placeholder);
        return completions;}
    Codex.makeCloud=makeCloud;

    function cloudSpan(completions,dterm,scores,freqs,cuethresh){
        var freq=freqs.get(dterm)||1;
        var score=scores.get(dterm);
        var span=cloudEntry(completions,dterm);
        span.title=((score)?("score="+score):("unscored"))+"; "+
            "freq="+freq;
        if (freq===1) addClass(span,"singleton");        
        if (typeof cuethresh !== "number") {
            if (typeof dterm === "string") {}
            else if (dterm.prime) addClass(span,"cue");
            else {}}
        else if ((score)&&(score>cuethresh))
            addClass(span,"cue");
        else if (dterm.prime) addClass(span,"cue");
        else {}
        return span;}

    function getShowAll(use_cues,how_many){
        var showall=(use_cues)&&
            fdjtDOM(
                "span.showall",
                fdjtDOM("span.showmore","more",
                        ((how_many)&&(" ("+how_many+")"))),
                fdjtDOM("span.showless","fewer"));
        if (showall) showall.onclick=showempty_ontap;
        return showall;}

    function organize_tags(tags,scores,knodule,sourcedb){
        var min_score=false, max_score=false;
        var normals={}, n_normal=0, n_primes=0;
        var i=0; while (i<tags.length) {
            var tag=tags[i++];
            if (tag instanceof Ref) {
                if (tag.prime) n_primes++;
                if ((tag._db!==sourcedb)&&(!(tag.weak))) {
                    normals[tag]=true; n_normal++;}}
            if (scores) {
                var score=scores.get(tag);
                if (score) {
                    if (min_score===false) min_score=score;
                    else if (score<min_score) min_score=score;
                    if (score>max_score) max_score=score;}}}
        normals._count=n_normal;
        return {normals: normals, n_primes: n_primes,
                min: min_score, max: max_score};}

    function showempty_ontap(evt){
        var target=fdjtUI.T(evt);
        var completions=fdjtDOM.getParent(target,".completions");
        if (completions) {
            fdjtUI.cancel(evt);
            fdjtDOM.toggleClass(completions,"showempty");
            setTimeout(function(){
                Codex.UI.updateScroller(completions);},
                       100);}}

    function add_searchtag(value){
        setQuery(Codex.extendQuery(Codex.query,value));}

    Codex.UI.searchCloudToggle=function(){
        fdjtDOM.toggleClass(fdjtID('CODEXSEARCHCLOUD'),'showempty');
        Codex.UI.updateScroller(fdjtID('CODEXSEARCHCLOUD'));};

})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
