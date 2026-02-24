function mainHandicap() {
  return {
    users: [],
    me:me,
    courseId: "",
    results: USERSHANDICAP,
    userId: "",
    teeSelected: "",
    teeMens: "",
    teeLadies: "",
    providerSelected: "3",
    search: "",
    openModalLoading() {
      $("#modalLoading").modal({
        backdrop: "static",
        keyboard: false,
      });
    },
    openModal() {
      $("#modalHandicap").modal();
    },
    closeInfoModal() {
      $("#modalHandicap").modal("hide")
    },
    addUser() {
      if (USERSHANDICAP.length) {
        if (this.users.some((e) => e.id == this.userId)) {
          this.userId = "";
          this.search = "";
          return;
        } else {
          let result = USERSHANDICAP.find((obj) => {
            return obj.id == this.userId.toString();
          });
              $.ajax({
                url: BASE + "user/get_handicap_info/",
                data: {
                  user_id: result.id,
                  course_id: this.courseId,
                  tee: this.teeSelected,
                  provider:this.provider,
                },
                type: "POST",
         
                success: (data) => {          
                    console.log("a");
                      let response = JSON.parse(data);
                      console.log(response);
                      result.lowest = response.lowest;
                      result.index = response.index;
                      result.cIndex = response.cIndex;
                      result.attest = response.attest + "%";
                      result.index_ghap = response.index_ghap;
                      result.index_federation = response.index_federation;
                      result.teebox_handicap = response.teebox_handicap;
                      let color = "gray";
                      if (response.attest <= 30) color = "red";
                      if (response.attest <= 80 && response.attest >= 31) {
                        color = "gold";
                      }
                      if (response.attest >= 81 && response.attest <= 100) {
                        color = "green";
                      }
                      result.class = color;
                      this.users.push(result);
                      console.log(this.users);
                    }
          });

          this.userId = "";
          this.search = "";
          USERSHANDICAP = [];
          this.results = USERSHANDICAP;
        }
      }
    },
    addFirstUser() {
      if (me.id) {
        $.ajax({
          url: BASE + "user/get_handicap_info/",
          data: {
            user_id: me.id,
          },
          type: "POST",
          success: (data) => {     
            let response = JSON.parse(data);
            me.lowest = response.lowest;
            me.index = response.index;
            me.cIndex = response.cIndex;
            me.attest = response.attest + "%";
            me.index_ghap = response.index_ghap;
            me.index_federation = response.index_federation;
            me.teebox_handicap = response.teebox_handicap;
            let color = "gray";
            if (response.attest <= 30) color = "red";
            if (response.attest <= 80 && response.attest >= 31) {
              color = "gold";
            }
            if (response.attest >= 81 && response.attest <= 100) {
              color = "green";
            }
            me.class = color;
            this.users.push(me);
          }
        });
      }
    },
    removeUser(id) {
      // get index of object with userID
      var removeIndex = this.users
        .map(function (item) {
          return item.id;
        })
        .indexOf(id);

      // remove object
      this.users.splice(removeIndex, 1);
    },
    init() {
      this.providerSelected =$("#provider").val(); 
      $("#provider").change((e) => {
        this.providerSelected = e.target.value; 
      });
      this.addFirstUser();
      $("#filterCourseIdScore").change((e) => {
        let courseId = e.target.value;
        this.courseId = courseId;
        if (!courseId) return;
        $("#tees").load(BASE + "score/ajax_tees/" + courseId + "/0");
      });

      $("#tees,#provider").change((e) => {
        if(e.target.value!=7 && e.target.value!=3){
          this.teeSelected = e.target.value;
        }
        var element = $("#tees").find("option:selected");
        if(this.providerSelected==7){
          this.teeMens = element.attr("ms")
          ? "Mens Statistical Par: " +
            element.attr("msp") +
            " Handicap Adjustment: " +
            element.attr("mha")
          : "";
        this.teeLadies = element.attr("ls")
          ? "Ladies Statistical Par: " +
            element.attr("lsp") +
            " Handicap Adjustment: " +
            element.attr("lha")
          : "";
        }else{
          this.teeMens = element.attr("ms")
          ? "Mens Slope: " +
            element.attr("ms") +
            " Rating: " +
            element.attr("mr")
          : "";
        this.teeLadies = element.attr("ls")
          ? "Ladies Slope: " +
            element.attr("ls") +
            " Rating: " +
            element.attr("lr")
          : "";
        }
        

        if (this.users.length && this.teeSelected) {  
          this.users.map((u) => {
            var indexCourse=u.index;
            if(this.providerSelected==7){
              indexCourse=u.index_ghap;
            }
            //this.openModalLoading();
            $.ajax({
              url: BASE + "user/ajax_course_hdcp_lookup/",
              data: {
                user_id: u.id,
                user_hdcp: indexCourse,
                course_id: this.courseId,
                tee: this.teeSelected,
                provider:this.providerSelected
              },
              type: "POST",
              success: (data) => {  
                let response = JSON.parse(data);
                u.cIndex = response ? response : "N/A";
                u.teebox_handicap = response ? response : "N/A";      
            }
            })
           
          });
          //$('#modalLoading').modal('hide');
        }
      });

      $("#userId").change((e) => {
        this.userId = e.target.value;
      });
    },
    timeoutUser: null,
    findSuggestions() {
      clearTimeout(this.timeoutUser);
      let element = $("#typerUserHandicap");
      let search = $("#typerUserHandicap").val();
      let suggestions = element.siblings(".options");
      suggestions.removeClass("h");
      let loading = $("#spinner-user-handicap");
      loading.css("opacity", "100");
      if (search != "") {
        this.timeoutUser = setTimeout(() => {
          $.ajax({
            type: "POST",
            url: BASE + "user/ajax_search_users_json",
            data:{"search":search},
            dataType: "JSON",
            success: (data) => {
              if (typeof USERSHANDICAP !== "undefined") {
                USERSHANDICAP = data;
                this.results = USERSHANDICAP;
              }
              $(suggestions).html("");
              loading.css("opacity", "0");
              $.each(data, (i, option) => {
                let location = option.location;
                $(suggestions).append(
                  $("<a/>")
                    .append('<b class="name">' + option.name + "</b>")
                    .addClass("courserow suggestion")
                    .append(
                      $('<input type="hidden"/>')
                        .attr("id", "location")
                        .val(location)
                    )
                    .append(
                      $('<input type="hidden"/>')
                        .attr("id", "username")
                        .val(option.username)
                    )
                    .append(
                      $('<input type="hidden"/>')
                        .attr("id", "fullname")
                        .val(option.name)
                    )
                    .append(
                      $('<input type="hidden"/>')
                        .attr("id", "userId")
                        .val(option.id)
                    )
                    .append($("<span  />").text(location))
                );
              });

              $(suggestions)
                .children()
                .on("click", (event) => {
                  let sugg = event.target;

                  if (sugg.tagName.toLowerCase() === "a") {
                    sugg = event.target;
                  } else if (
                    sugg.tagName.toLowerCase() === "b" ||
                    sugg.tagName.toLowerCase() === "span"
                  ) {
                    sugg = sugg.parentElement;
                  }
                  let fullname = sugg.querySelector("#fullname").value;
                  let userId = sugg.querySelector("#userId").value;
                  this.userId = userId;
                  this.search = fullname;
                  $(".options-autocomplete").html("");
                  this.results = [];
                });
            },
          });
        }, 600);
      }
    },
  };
}
