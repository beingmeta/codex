/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

var codex_search_id="$Id$";
var codex_search_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2012 beingmeta, inc.
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

(function(){
    Codex.full_cloud=false;
    if (!(Codex.empty_cloud)) Codex.empty_cloud=false;
    if (!(Codex.show_refiners)) Codex.show_refiners=25;
    if (!(Codex.search_gotlucky)) Codex.search_gotlucky=7;
    
    function sbicon(name,suffix) {return Codex.graphics+name+(suffix||"");}
    function cxicon(name,suffix) {
	return Codex.graphics+"codex/"+name+(suffix||"");}

    var addClass=fdjtDOM.addClass;

    /* Query functions */

    /* Set on main search input */
    // id="CODEXSEARCHINPUT" 
    // completions="CODEXSEARCHCLOUD"

    var Query=KnoduleIndex.Query;

    Codex.getQuery=function(){return Codex.query;}
    
    function setQuery(query){
	if (Codex.Trace.search) fdjtLog("Setting working query to %o",query);
	var query=Codex.query=useQuery(query,fdjtID("CODEXSEARCH"));
	if (Codex.mode==="search") {
	    if (query._results.length===0) {}
	    else if ((query._results.length===1)&&
		(document.getElementById(query._results[0]))) {
		Codex.GoTo(query._results[0]);}
	    else if (query._results.length<7)
		showSearchResults();
	    else {}}}

    Codex.setQuery=setQuery;

    function useQuery(query,box_arg){
	var result;
	if (query instanceof Query) result=query;
	else result=Codex.index.Query(query);
	var qstring=result.getString();
	if ((box_arg)&&(typeof box_arg === 'string'))
	    box_arg=document.getElementById(box_arg);
	var box=box_arg||result._box||fdjtID("CODEXSEARCH");
	if ((query.dom)&&(box)&&(box!==query.dom))
	    fdjtDOM.replace(box_arg,query.dom);
	if (qstring===box.getAttribute("qstring")) {
	    fdjtLog("No change in query for %o to %o: %o/%o (%o)",
		    box,result._query,result,result._refiners,qstring);
	    return;}
	if (Codex.Trace.search>1)
	    fdjtLog("Setting query for %o to %o: %o/%o (%o)",
		    box,result._query,result,result._refiners,qstring);
	else if (Codex.Trace.search)
	    fdjtLog("Setting query for %o to %o: %d results/%d refiners (%o)",
		    box,result._query,result._results.length,
		    result._refiners._results.length,qstring);
	var input=fdjtDOM.getChild(box,".searchinput");
	var cloudid=input.getAttribute("completions");
	var resultsid=input.getAttribute("results");
	var qtags=fdjtDOM.getChild(box,".qtags");
	var cloud=((cloudid)&&(fdjtID(cloudid)))||
	    fdjtDOM.getChild(box,".searchcloud");
	var results=((resultsid)&&(fdjtID(resultsid)))||
	    fdjtDOM.getChild(box,".searchresults");
	var resultcount=fdjtDOM.getChild(box,".resultcount");
	var refinecount=fdjtDOM.getChild(box,".refinecount");
	// Update (clear) the input field
	input.value='';
	var elts=result._query; var i=0; var lim=elts.length;
	// Update 'notags' class
	if (elts.length) fdjtDOM.dropClass(box,"notags");
	else addClass(box,"notags");
	// Update the query tags
	var newtags=fdjtDOM("span.qtags");
	while (i<lim) {
	    var tag=elts[i];
	    if (typeof tag === 'string') tag=fdjtKB.ref(tag)||tag;
	    if (i>0) fdjtDOM(newtags," \u00B7 ");
	    if (typeof tag === "string")
		fdjtDOM(newtags,fdjtDOM("span.dterm",tag));
	    else if (tag.name)
		fdjtDOM(newtags,tag.name);
	    else fdjtDOM(newtags,tag);
	    i++;}
	if (qtags.id) newtags.id=qtags.id;
	fdjtDOM.replace(qtags,newtags);
	// Update the results display
	if (result._results.length) {
	    resultcount.innerHTML=result._results.length+
		" passage"+((result._results.length===1)?"":"s");
	    fdjtDOM.dropClass(box,"noresults");}
	else {
	    resultcount.innerHTML="no results";
	    addClass(box,"noresults");}
	// Update the search cloud
	var n_refiners=
	    ((result._refiners)&&(result._refiners._results.length))||0;
	var completions=Codex.queryCloud(result);
	refinecount.innerHTML=n_refiners+
	    ((n_refiners===1)?(" associated tag"):(" associated tags"));
	fdjtDOM.dropClass(box,"norefiners");
	if (cloudid) completions.id=cloudid;
	if (Codex.Trace.search>1)
	    fdjtLog("Setting search cloud for %o to %o",
		    box,completions.dom);
	cloudid=cloud.id;
	fdjtDOM.replace(cloud,completions.dom);
	    completions.complete("");
	if (n_refiners===0) {
	    addClass(box,"norefiners");
	    refinecount.innerHTML="no refiners";}
	result._box=box; box.setAttribute(qstring,qstring);
	Codex.UI.updateScroller(completions.dom);
	return result;}
    Codex.useQuery=useQuery;

    function extendQuery(query,elt){
	var elts=[].concat(query._query);
	if (typeof elt === 'string') 
	    elts.push(fdjtKB.ref(elt)||elt);
	else elts.push(elt);
	return useQuery(query.index.Query(elts),query._box);}
    Codex.extendQuery=extendQuery;

    Codex.updateQuery=function(input_elt){
	var q=Knodule.Query.string2query(input_elt.value);
	if ((q)!==(Codex.query._query))
	    Codex.setQuery(q,false);};

    function showSearchResults(){
	fdjtDOM.replace("CODEXSEARCHRESULTS",Codex.query.showResults());
	CodexMode("searchresults");
	fdjtID("CODEXSEARCHINPUT").blur();
	fdjtID("CODEXSEARCHRESULTS").focus();
	Codex.UI.updateScroller(fdjtID("CODEXSEARCHRESULTS"));}
    Codex.showSearchResults=showSearchResults;

    /* Call this to search */

    function startSearch(tag){
	setQuery([tag]);
	CodexMode("search");}
    Codex.startSearch=startSearch;

    /* Text input handlers */

    var _sbook_searchupdate=false;
    var _sbook_searchupdate_delay=200;
    
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
		if (completions.length) {
		    var value=completeinfo.getValue(completions[0]);
		    setQuery(extendQuery(Codex.query,value));}}
	    fdjtDOM.cancel(evt);
	    if ((Codex.search_gotlucky) && 
		(Codex.query._results.length>0) &&
		(Codex.query._results.length<=Codex.search_gotlucky))
		showSearchResults();
	    else {
		/* Handle new info */
		var completeinfo=queryCloud(Codex.query);
		completeinfo.complete("");}
	    return false;}
	else if (ch==32) { /* Space */
	    var qstring=target.value;
	    var completeinfo=queryCloud(Codex.query);
	    var completions=completeinfo.complete(qstring);
	    if (completions.prefix!==qstring) {
		target.value=completions.prefix;
		fdjtDOM.cancel(evt);
		setTimeout(function(){
		    Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
			   100);
		return;}}
	else {
	    var completeinfo=queryCloud(Codex.query);
	    completeinfo.docomplete(target);
	    setTimeout(function(){
		Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
		       100);}}
    Codex.UI.handlers.search_keyup=searchInput_keyup;

    /*
      function searchInput_onkeyup(evt){
      evt=evt||event||null;
      var kc=evt.keyCode;
      if ((kc===8)||(kc===46)) {
      if (_sbook_searchupdate) {
      clearTimeout(_sbook_searchupdate);
      _sbook_searchupdate=false;}
      var target=fdjtDOM.T(evt);
      _sbook_searchupdate=
      setTimeout(function(target){
      _sbook_searchupdate=false;
      searchUpdate(target);},
      _sbook_searchupdate_delay,target);}}
      Codex.UI.handlers.SearchInput_onkeyup=searchInput_onkeyup;
    */

    function searchUpdate(input,cloud){
	if (!(input)) input=fdjtID("CODEXSEARCHINPUT");
	if (!(cloud)) cloud=queryCloud(Codex.query);
	cloud.complete(input.value);}
    Codex.searchUpdate=searchUpdate;

    function searchInput_focus(evt){
	evt=evt||event||null;
	var input=fdjtDOM.T(evt);
	sbook_search_focus=true;
	if ((Codex.mode)&&(Codex.mode==='searchresults'))
	    CodexMode("search");
	searchUpdate(input);}
    Codex.UI.handlers.search_focus=searchInput_focus;

    function searchInput_blur(evt){
	evt=evt||event||null;
	sbook_search_focus=false;}
    Codex.UI.handlers.search_blur=searchInput_blur;

    function clearSearch(evt){
	var target=fdjtUI.T(evt||event);
	var box=fdjtDOM.getParent(target,".searchbox");
	var input=fdjtDOM.getChild(box,".searchinput");
	fdjtUI.cancel(evt);
	setQuery(Codex.empty_query);
	input.focus();}
    Codex.UI.handlers.clearSearch=clearSearch;
    
    Codex.toggleSearch=function(evt){
	evt=evt||event;
	if ((Codex.mode==="search")||
	    (Codex.mode==="searchresults"))
	    CodexMode(false);
	else {
	    CodexMode("search");
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

    function showResults(result){
	if (result._results_div) return result._results_div;
	var results=result._results; var rscores=result._scores;
	var scores={}; var sorted=[];
	var i=0; var lim=results.length;
	var scores=new Array(lim);
	while (i<lim) {
	    var r=results[i++];
	    var ref=Codex.docinfo[r]||Codex.glosses.map[r]||fdjtKB.ref(r)||r;
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
	if (!(result)) result=Codex.query;
	var div=fdjtDOM("div.codexslice.sbookresults");
	Codex.UI.addHandlers(div,'summary');
	Codex.UI.showSlice(result._results,div,rscores);
	result._results_div=div;
	return div;}
    KnoduleIndex.Query.prototype.showResults=
	function(){return showResults(this);};
    
    /* Getting query cloud */

    function queryCloud(query){
	if (query._cloud) return query._cloud;
	else if ((query._query.length)===0) {
	    query._cloud=fullCloud();
	    return query._cloud;}
	else if (!(query._refiners)) {
	    query._cloud=Codex.empty_cloud;
	    return query._cloud;}
	else {
	    var completions=
		makeCloud(query._refiners._results,query._refiners._freqs);
	    completions.onclick=cloud_ontap;
	    var n_refiners=query._refiners._results.length;
	    var hide_some=(n_refiners>Codex.show_refiners);
	    if (hide_some) {
		var cues=fdjtDOM.$(".cue",completions);
		if (!((cues)&&(cues.length))) {
		    var compelts=fdjtDOM.$(".completion",completions);
		    var i=0; var lim=((compelts.length<Codex.show_refiners)?
				      (compelts.length):(Codex.show_refiners));
		    while (i<lim) addClass(compelts[i++],"cue");}}
	    else addClass(completions,"showempty");
	    query._cloud=
		new fdjtUI.Completions(completions,fdjtID("CODEXSEARCHINPUT"));
	    return query._cloud;}}
    Codex.queryCloud=queryCloud;
    KnoduleIndex.Query.prototype.getCloud=function(){return queryCloud(this);};

    function cloud_ontap(evt){
	evt=evt||event;
	var target=fdjtDOM.T(evt);
	var completion=fdjtDOM.getParent(target,".completion");
	if (completion) {
	    var cinfo=Codex.query._cloud;
	    var value=cinfo.getValue(completion);
	    add_searchtag(value);
	    fdjtDOM.cancel(evt);}
	else if (fdjtDOM.inherits(target,".resultcounts")) {
	    showSearchResults(Codex.query);
	    CodexMode("searchresults");
	    fdjtID("CODEXSEARCHINPUT").blur();
	    fdjtID("CODEXSEARCHRESULTS").focus();
	    fdjtDOM.cancel(evt);}
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

    function makeCloud(dterms,scores,noscale,alphabetize){
	var sbook_index=Codex.index;
	var start=new Date();
	if (Codex.Trace.clouds)
	    fdjtLog("Making cloud from %d dterms using scores=%o and scores=%o",
		    dterms.length,scores,scores);
	var spans=fdjtDOM("span");  
	var tagicon=fdjtDOM.Image
	(cxicon("TagSearch50x50.png"),
	 ".cloudtoggle","show/hide all","show all tags");
	tagicon.onclick=showempty_ontap;
	var completions=fdjtDOM("div.completions",tagicon,spans);
	var n_terms=dterms.length;
	var i=0; var max_score=0;
	if (scores) {
	    var i=0; while (i<dterms.length) {
		var score=scores[dterms[i++]];
		if ((score) && (score>max_score)) max_score=score;}}
	var copied=[].concat(dterms);
	var bykey=sbook_index.items;
	// We sort the keys by absolute frequency
	if (alphabetize) copied.sort();
	else copied.sort(function (x,y) {
	    var xlen=((bykey[x])?(bykey[x].length):(0));
	    var ylen=((bykey[y])?(bykey[y].length):(0));
	    if (xlen==ylen) {
		if (x>y) return -1;
		else if (x===y) return 0;
		else return 1;}
	    else if (xlen>ylen) return -1;
	    else return 1;});
	// Then we scale the keys by the ratio of result frequency to
	// absolute frequency
	var nspans=0; var sumscale=0;
	var minscale=false; var maxscale=false;
	var domnodes=[]; var nodescales=[];
	var primescores=
	    ((Codex.knodule.prime)&&
	     (Codex.knodule.prime.length)&&
	     (Codex.knodule.primescores));
	var dterms=Codex.knodule.dterms;
 	i=0; while (i<copied.length) {
	    var dterm=copied[i++];
	    var count=((bykey[dterm]) ? (bykey[dterm].length) : (1));
	    var freq=((scores)?(scores[dterm]||1):(1));
	    var score=((scores) ?(scores[dterm]||false) : (false));
	    var title=
		((Codex.noisy_tooltips) ?
		 (""+(((score)?("s="+score+"; "):"")+freq+"/"+count+" items")) :
		 (""+freq+((freq==1) ? " item" : " items")));
	    var span=KNodeCompletion(dterm,title,false);
	    if (!(span)) continue;
	    // Use a knode as a cue if it is declared PRIME in the knodule,
	    //  or if it's non-auto and has a corresonding dterm
	    if (primescores) {
		if (primescores[dterm]) addClass(span,"cue");}
	    else if (dterm[0]==='~') {}
	    // else if ((dterms[dterm])&&(!((dterms[dterm]).weak))) addClass(span,"cue");
	    else {}
	    domnodes.push(span);
	    if (freq===1) addClass(span,"singleton");
	    if ((scores)&&(!(noscale))) {
		var relfreq=
		    ((freq/scores._count)/(count/Codex.docinfo._eltcount));
		var scaling=Math.sqrt(relfreq);
		if ((!(minscale))||(scaling<minscale)) minscale=scaling;
		if ((!(maxscale))||(scaling>maxscale)) maxscale=scaling;
		nodescales.push(scaling);}
	    fdjtDOM(spans,span,"\n");}
	if (nodescales.length) {
	    var j=0; var jlim=domnodes.length;
	    var overscale=100/(maxscale-minscale);
	    while (j<jlim) {
		var node=domnodes[j];
		var scale=nodescales[j];
		node.style.fontSize=(100+((scale-minscale)*overscale))+'%';
		j++;}}
	var maxmsg=fdjtDOM
	("div.maxcompletemsg",
	 "There are a lot ","(",fdjtDOM("span.completioncount","really"),")",
	 " of completions.  ");
	fdjtDOM.prepend(completions,maxmsg);
	var end=new Date();
	if (Codex.Trace.clouds)
	    fdjtLog("Made cloud for %d dterms in %f seconds",
		    dterms.length,(end.getTime()-start.getTime())/1000);

	return completions;}
    Codex.makeCloud=makeCloud;

    function showempty_ontap(evt){
	var target=fdjtUI.T(evt);
	var completions=fdjtDOM.getParent(target,".completions");
	if (completions)
	    fdjtDOM.toggleClass(completions,"showempty");}

    function KNodeCompletion(term,title,just_knodes){
	var sbook_index=Codex.index; var showname=term;
	if ((typeof term === "string") && (term[0]==="\u00A7")) {
	    if (showname.length>20) {
		var start=showname.indexOf(' ',8);
		var end=showname.lastIndexOf(' ',showname.length-8);
		if (start<0) start=8; if (end<0) end=showname.length-8;
		if (start<(showname.length-end)) {
		    showname=showname.slice(0,start)+" \u2026 "+showname.slice(end);}
		title=term;}
	    var span=fdjtDOM("span.completion",fdjtDOM("span.sectname",showname));
	    span.key=term; span.value=term; span.anymatch=true;
	    span.title=""+sbook_index.freq(term)+" items: "+term;
	    return span;}
	var dterm=Codex.knodule.probe(term); var showterm=term;
	if (!(dterm)) {
	    if (just_knodes) return false;
	    var knopos=term.indexOf('@');
	    if ((knopos>0)&&(term.slice(1+knopos)===Codex.knodule.name)) {
		if (title) title="("+term+") "+title; else title=term;
		showterm=term.slice(0,knopos);}}
	else if (!(dterm.dterm)) {
	    fdjtLog("Got bogus dterm reference for %s: %o",term,dterm);
	    dterm=false;}
	var term_node=((dterm) ? (dterm.toHTML()) : (fdjtDOM("span.raw",showterm)));
	if ((dterm)&&(fdjtString.hasSuffix(dterm.dterm,"...")))
	    addClass(term_node,"weak");
	var span=fdjtDOM("span.completion");
	if (dterm) {
	    if (dterm.gloss) {
		if (title) span.title=title+": "+dterm.gloss;
		else span.title=dterm.gloss;}
	    // This would be a place to generate titles from the knodule itself
	    else span.title=title;
	    /* Now add variation elements */
	    var variations=[];
	    var i=0; var terms=dterm.getSet('EN');
	    while (i<terms.length) {
		var term=terms[i++];
		if (term===dterm.dterm) continue;
		var vary=fdjtDOM("span.variation",term);
		vary.key=term;
		span.appendChild(vary);
		span.appendChild(document.createTextNode(" "));}
	    span.appendChild(term_node);
	    span.key=dterm.dterm;
	    span.value=((dterm.tagString)?(dterm.tagString()):(dterm.dterm));
	    span.setAttribute("dterm",dterm.dterm);}
	else {
	    span.key=term; span.value=term;
	    span.appendChild(term_node);
	    if (title) span.title=title;}
	return span;}
    
    function add_searchtag(value){
	setQuery(Codex.extendQuery(Codex.query,value));}

    function fullCloud(){
	if (Codex.full_cloud) return Codex.full_cloud;
	else {
	    var tagscores=Codex.index.tagscores;
	    var alltags=Codex.index._alltags;
	    var tagfreqs=Codex.index.tagfreqs;
	    var completions=Codex.makeCloud(alltags,tagfreqs,false,false);
	    var cues=fdjtDOM.getChildren(completions,".cue");
	    completions.onclick=cloud_ontap;
	    Codex.full_cloud=new fdjtUI.Completions(completions);
	    return Codex.full_cloud;}}
    Codex.fullCloud=fullCloud;

    function sizeCloud(completions,container,index){
	if (!(index)) index=Codex.index;
	if (!(container)) container=completions.dom;
	var nodes=fdjtDOM.getChildren(container,".completion");
	var tagscores=index.tagscores;
	var max_score=index.maxscore;
	var alltags=index._alltags;
	var i=0; var lim=nodes.length;
	while (i<lim) {
	    var tagnode=nodes[i++];
	    var tag=tagnode.value||completions.getValue(tagnode);
            if (!(tag)) continue;
	    if ((typeof tag === "string") && (tag[0]==="\u00A7")) continue;
	    var score=tagscores[tag];
	    if (score) tagnode.style.fontSize=(100+(100*(score/max_score)))+"%";}}
    Codex.sizeCloud=sizeCloud;

})();


fdjt_versions.decl("codex",codex_search_version);
fdjt_versions.decl("codex/search",codex_search_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
